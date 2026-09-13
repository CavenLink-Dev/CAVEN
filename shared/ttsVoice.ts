// Hayes M — Calm British AI Customer Care (Voice Library). Premade George is
// the free-plan fallback: library ids 402 there, same as Edward and James.
export const HAYES_VOICE = 'sIivXWc5MTlPIP3kJXhg';
export const JAMES_VOICE = 'xru6qZB94sJdkyqP12qN';
export const GEORGE_VOICE = 'JBFqnCBsd6RMkjVDRZzb';

export function preferredVoice(envId: string | undefined): string {
  const id = envId?.trim();
  return id || HAYES_VOICE;
}

export function fallbackVoice(currentId: string, status: number, premade = GEORGE_VOICE): string | null {
  return status === 402 && currentId !== premade ? premade : null;
}
