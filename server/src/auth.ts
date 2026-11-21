import { createHash } from 'node:crypto';

/** Who a sign-in token belongs to. `phone` is E.164 (+91...) when the login was by phone. */
export type Identity = { sub: string; phone: string | null };

export interface TokenVerifier {
  /** Resolve a bearer token to an identity, or throw an error with statusCode 401 (invalid) or 503 (auth service down). */
  verify(token: string): Promise<Identity>;
}

const fail = (statusCode: number, message: string, code?: string) => Object.assign(new Error(message), { statusCode, appCode: code });

export const e164 = (raw: unknown): string | null => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? '+' + digits : null;
};

/**
 * Verifies a Supabase access token by asking Supabase Auth who it belongs to (GET /auth/v1/user).
 * This works with any signing-key setup and notices revoked sessions. Results are cached for a short time
 * so one app screen does not make a network round trip per request.
 */
export function supabaseVerifier(baseUrl: string, anonKey: string, opts: { ttlMs?: number; fetchFn?: typeof fetch } = {}): TokenVerifier {
  const ttl = opts.ttlMs ?? 60_000;
  const doFetch = opts.fetchFn ?? fetch;
  const cache = new Map<string, { id: Identity; until: number }>();
  const url = baseUrl.replace(/\/$/, '') + '/auth/v1/user';
  return {
    async verify(token) {
      const key = createHash('sha256').update(token).digest('hex');
      const hit = cache.get(key);
      if (hit && hit.until > Date.now()) return hit.id;
      let res: Response;
      try {
        res = await doFetch(url, { headers: { authorization: `Bearer ${token}`, apikey: anonKey }, signal: AbortSignal.timeout(8000) });
      } catch {
        throw fail(503, 'Sign-in service is not reachable', 'auth_unavailable');
      }
      if (res.status === 401 || res.status === 403) throw fail(401, 'Your sign-in has expired. Please sign in again.', 'unauthenticated');
      if (!res.ok) throw fail(503, 'Sign-in service error', 'auth_unavailable');
      const j = (await res.json()) as { id?: string; phone?: string };
      if (!j.id) throw fail(401, 'Invalid sign-in', 'unauthenticated');
      const id: Identity = { sub: j.id, phone: e164(j.phone) };
      if (cache.size > 2000) cache.clear();
      cache.set(key, { id, until: Date.now() + ttl });
      return id;
    },
  };
}
