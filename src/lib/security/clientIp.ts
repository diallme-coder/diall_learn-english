// src/lib/security/clientIp.ts
//
// Resolves the client IP from request headers. `x-real-ip` is trusted
// first (typically set by a single reverse proxy to the true client IP).
// Otherwise `x-forwarded-for` is walked from the right by
// `trustedProxyHops`: the rightmost entry is the proxy closest to us, so
// the client IP sits `trustedProxyHops` entries in from the right.
// Returns null when no usable IP can be determined, which tells the
// caller to skip the IP-scoped rate-limit bucket rather than guess.

export interface HeaderReader {
  get(name: string): string | null;
}

export function parseClientIp(headers: HeaderReader, trustedProxyHops = 1): string | null {
  const realIp = headers.get('x-real-ip');
  if (realIp && realIp.trim() !== '') return realIp.trim();

  const forwardedFor = headers.get('x-forwarded-for');
  if (!forwardedFor) return null;

  const ips = forwardedFor
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip !== '');
  if (ips.length === 0) return null;

  const index = ips.length - trustedProxyHops;
  if (index < 0 || index >= ips.length) return null;
  return ips[index] ?? null;
}
