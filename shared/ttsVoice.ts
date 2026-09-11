// James (Voice Library) is tried first when env is unset. Free ElevenLabs
// plans 402 library voices; George is a premade British male that still works.
export const JAMES_VOICE = 'xru6qZB94sJdkyqP12qN';
export const GEORGE_VOICE = 'JBFqnCBsd6RMkjVDRZzb';

export function preferredVoice(envId: string | undefined): string {
  const id = envId?.trim();
  return id || JAMES_VOICE;
}

export function fallbackVoice(currentId: string, status: number, premade = GEORGE_VOICE): string | null {
  return status === 402 && currentId !== premade ? premade : null;
}
