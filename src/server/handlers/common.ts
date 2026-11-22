// src/server/handlers/common.ts
//
// `withGuards` runs the shared guard pipeline, in this exact order, before
// handing off to a route's own handler function:
//
//   1. method check
//   2. origin check (origin.ts)                      -> 403 (not 401) on a foreign origin
//   3. IP rate limit (rateLimit.ts, scope 'ip')       -> 429, before auth is ever touched
//   4. JWT precheck (jwt.ts), no network              -> 401 on a malformed/expired token
//   5. auth.verify (adapter; has its own negative cache)
//   6. user rate limit (scope 'user', + daily budget) -> 429
//
// Steps 7-9 (capped body read, validation, calling the port) are route
// specific and are left to each handler, which receives a `GuardContext`
// once the above all pass.

import type { AppError, AuthContext, RateLimitedRoute } from '../../lib/types.ts';
// `ServerDeps` here comes from `../deps.ts`, not the frozen `../../lib/types.ts`
// one: it carries the `PrivacyStore.hasCurrentConsent` extension (see
// deps.ts's own comment) through `GuardContext` to every handler, since
// transcribe.ts's guard needs it.
import type { ServerDeps } from '../deps.ts';
import { checkOrigin } from '../../lib/security/origin.ts';
import { precheckJwtExpiry } from '../../lib/security/jwt.ts';
import { errorResponse } from '../http.ts';

export interface GuardContext {
  req: Request;
  deps: ServerDeps;
  auth: AuthContext;
}

export interface WithGuardsOptions {
  route: RateLimitedRoute;
  methods: readonly string[];
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

function err(error: AppError): Response {
  return errorResponse(error);
}

export async function withGuards(
  req: Request,
  deps: ServerDeps,
  opts: WithGuardsOptions,
  handler: (ctx: GuardContext) => Promise<Response>,
): Promise<Response> {
  // 1. method
  if (!opts.methods.includes(req.method)) {
    return err({ code: 'bad_request', message: `Method ${req.method} is not allowed on this route.` });
  }

  // 2. origin
  const originHeader = req.headers.get('origin');
  if (!checkOrigin(originHeader, deps.allowedOrigins)) {
    return err({ code: 'forbidden', message: 'Origin is not allowed.' });
  }

  const nowMs = deps.clock.now();

  // 3. IP rate limit
  const ip = deps.clientIp(req);
  if (ip !== null) {
    const ipDecision = deps.limiter.take('ip', ip, opts.route, nowMs);
    if (!ipDecision.allowed) {
      return err({ code: 'rate_limited', message: 'Too many requests from this network.', retryAfterSec: ipDecision.retryAfterSec });
    }
  }

  // 4. JWT precheck (no network call)
  const token = bearerToken(req);
  if (!token) {
    return err({ code: 'unauthorized', message: 'Missing bearer token.' });
  }
  if (!precheckJwtExpiry(token, nowMs)) {
    return err({ code: 'unauthorized', message: 'Token is expired or malformed.' });
  }

  // 5. auth.verify (real adapter has its own negative cache)
  const authResult = await deps.auth.verify(req.headers.get('authorization'), nowMs);
  if (!authResult.ok) {
    return err(authResult.error);
  }
  const auth = authResult.value;

  // 6. user rate limit (+ daily budget on paid routes)
  const userDecision = deps.limiter.take('user', auth.userId, opts.route, nowMs);
  if (!userDecision.allowed) {
    return err({ code: 'rate_limited', message: 'Rate limit exceeded.', retryAfterSec: userDecision.retryAfterSec });
  }

  return handler({ req, deps, auth });
}
