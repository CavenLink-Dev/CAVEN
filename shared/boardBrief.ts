// Compact briefing of Keanu's persisted board for the chat model.
// Loose objects only — do not import mockData, or the Edge bundle pulls seed.

function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row) => row && typeof row === "object",
  ) as Record<string, unknown>[]
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function money(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return text(value)
  const abs = Math.abs(n)
  const body = Number.isInteger(abs)
    ? String(abs)
    : abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
  return n < 0 ? `-${body}` : body
}

function join(parts: string[], sep = "; "): string {
  return parts.filter(Boolean).join(sep)
}

function firstLine(value: unknown, max = 80): string {
  const line = text(value).split(/\n/)[0]?.trim() ?? ""
  if (line.length <= max) return line
  return `${line.slice(0, max - 1).trimEnd()}…`
}

export function boardBrief(state: unknown): string {
  if (!state || typeof state !== "object") return ""
  const s = state as Record<string, unknown>
  const lines: string[] = []

  // Only when he has chosen something other than the default — the common case costs nothing.
  const address = text(s.address)
  if (address && address.toLowerCase() !== "sir")
    lines.push(`Address him as: ${address}`)

  const openTasks = list(s.tasks)
    .filter((t) => !t.done)
    .slice(0, 8)
    .map((t) =>
      join([text(t.title), text(t.time) ? `(${text(t.time)})` : ""], " "),
    )
  if (openTasks.length) lines.push(`Open tasks: ${openTasks.join("; ")}`)

  const habits = list(s.habits)
    .slice(0, 6)
    .map((h) => {
      const streak = text(h.streak)
      return join(
        [
          text(h.name),
          streak ? `streak ${streak}` : "",
          h.done ? "done today" : "not done",
        ],
        " ",
      )
    })
  if (habits.length) lines.push(`Habits: ${habits.join("; ")}`)

  const calendar = list(s.calendar)
    .slice(0, 6)
    .map((e) => join([text(e.time), text(e.title)], " "))
  if (calendar.length) lines.push(`Today: ${calendar.join("; ")}`)

  const reminders = list(s.reminders)
    .slice(0, 4)
    .map((r) => join([text(r.title), text(r.date), text(r.time)], " "))
  if (reminders.length) lines.push(`Reminders: ${reminders.join("; ")}`)

  const budgets = list(s.budgets).map((b) => {
    const cat = text(b.category)
    if (!cat) return ""
    return `${cat} ${money(b.spent)}/${money(b.limit)}`
  })
  const tx = list(s.transactions)
    .slice(0, 4)
    .map((t) =>
      join(
        [text(t.label), money(t.amount), text(t.category), text(t.when)],
        " ",
      ),
    )
  const moneyLine = join(
    [
      budgets.filter(Boolean).length ? `Money: ${join(budgets)}` : "",
      tx.length ? `Last: ${tx.join("; ")}` : "",
    ],
    ". ",
  )
  if (moneyLine) lines.push(moneyLine)

  const journal = list(s.journal)[0]
  if (journal) {
    const title = text(journal.title)
    const body = firstLine(journal.body)
    const bit = join([title, body], " — ")
    if (bit) lines.push(`Journal: ${bit}`)
  }

  const notes = (Array.isArray(s.brainNotes) ? s.brainNotes : [])
    .map((n) => text(n))
    .filter(Boolean)
    .slice(0, 4)
  if (notes.length) lines.push(`Brain: ${notes.join("; ")}`)

  if (!lines.length) return ""
  return `BOARD\n${lines.join("\n")}`
}
