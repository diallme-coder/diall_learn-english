// src/lib/security/origin.ts
//
// Same-origin-or-allowlist check for the `Origin` request header. A request
// with no `Origin` header (a normal same-origin navigation, or a
// server-to-server call) is treated as allowed; a request that does carry
// an `Origin` header must match the allowlist exactly.

export function checkOrigin(originHeader: string | null, allowedOrigins: readonly string[]): boolean {
  if (originHeader === null) return true;
  return allowedOrigins.includes(originHeader);
}
