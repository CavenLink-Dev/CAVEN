export type CavenUser = { id: string; is_anonymous: boolean };

export function signedInUser(payload: unknown): CavenUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const { id, is_anonymous } = payload as { id?: unknown; is_anonymous?: unknown };
  if (typeof id !== 'string' || !id || is_anonymous === true) return null;
  return { id, is_anonymous: false };
}
