// Premade British male (George). Voice Library ids (Edward, James) 402 on a free plan.
export const JAMES_VOICE = "xru6qZB94sJdkyqP12qN"
export const GEORGE_VOICE = "JBFqnCBsd6RMkjVDRZzb"

export function preferredVoice(envId: string | undefined): string {
  const id = envId?.trim()
  return id || GEORGE_VOICE
}

export function fallbackVoice(
  currentId: string,
  status: number,
  premade = GEORGE_VOICE,
): string | null {
  return status === 402 && currentId !== premade ? premade : null
}
