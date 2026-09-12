// Shared "today" label so every board shows the same date, filled or empty.
// e.g. "Friday, 12 September". Call inside a useMemo so it settles once per mount.
export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
