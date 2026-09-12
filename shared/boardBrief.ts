// Compact briefing of Keanu's persisted board for the chat model.
// Loose objects only — do not import mockData, or the Edge bundle pulls seed.
// shared/when.ts is safe to pull in: it is pure date arithmetic and no data.
//
// Every line here is resent on every turn, so each one has to earn its tokens.
// That is why the lists are short and the notes are trimmed to a first line.
// Relative imports under shared/ carry a `.js` extension, never `.ts` and never
// bare. Everything here is emitted as .js beside its siblings, and the two
// runtimes fail in different places when the specifier doesn't say so:
//   .ts   — the Edge bundler refuses it outright ("referencing unsupported
//           modules"), failing the DEPLOY after a green build.
//   bare  — the Node runtime resolves literally and throws
//           ERR_MODULE_NOT_FOUND at INVOCATION, after a green deploy.
// `pnpm build` catches neither: it only runs tsc and vite, and never bundles a
// function. `npx vercel build --prod` does, and the emitted bundle can be read.
import { dayKey, dayLabel, parseStamp } from "./when.js";

function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function money(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return text(value);
  const abs = Math.abs(n);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return n < 0 ? `-${body}` : body;
}

function join(parts: string[], sep = "; "): string {
  return parts.filter(Boolean).join(sep);
}

function firstLine(value: unknown, max = 80): string {
  const line = text(value).split(/\n/)[0]?.trim() ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1).trimEnd()}…`;
}

export function boardBrief(state: unknown, now = new Date()): string {
  if (!state || typeof state !== "object") return "";
  const s = state as Record<string, unknown>;
  const lines: string[] = [];
  const today = dayKey(now);

  // Only when he has chosen something other than the default — the common case costs nothing.
  const address = text(s.address);
  if (address && address.toLowerCase() !== "sir") lines.push(`Address him as: ${address}`);

  const openTasks = list(s.tasks)
    .filter((t) => !t.done)
    .slice(0, 8)
    .map((t) => join([text(t.title), text(t.time) ? `(${text(t.time)})` : ""], " "));
  if (openTasks.length) lines.push(`Open tasks: ${openTasks.join("; ")}`);

  const habits = list(s.habits)
    .slice(0, 6)
    .map((h) => {
      const streak = text(h.streak);
      // The stored `done` flag was written on whatever day it was last ticked
      // and nothing clears it, so the date decides — never the flag.
      const ticked = text(h.lastDone) === today;
      return join([text(h.name), streak ? `streak ${streak}` : "", ticked ? "done today" : "not done"], " ");
    });
  if (habits.length) lines.push(`Habits: ${habits.join("; ")}`);

  // Events used to be listed under "Today" wholesale, whatever day they were
  // for, because nothing recorded the day. Anything undated is still one of
  // those older rows, and those were all saved as today.
  const events = list(s.calendar)
    .map((e) => ({ row: e, at: parseStamp(e.at) }))
    .filter(({ at }) => !at || dayKey(at) >= today)
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  const todays = events
    .filter(({ at }) => !at || dayKey(at) === today)
    .slice(0, 6)
    .map(({ row }) => join([text(row.time), text(row.title)], " "));
  if (todays.length) lines.push(`Today: ${todays.join("; ")}`);
  const ahead = events
    .filter(({ at }) => at && dayKey(at) > today)
    .slice(0, 4)
    .map(({ row, at }) => join([dayLabel(at as Date, now), text(row.time), text(row.title)], " "));
  if (ahead.length) lines.push(`Upcoming: ${ahead.join("; ")}`);

  const reminders = list(s.reminders)
    .slice(0, 4)
    .map((r) => {
      const due = parseStamp(r.dueAt);
      const when = due ? `${dayLabel(due, now)} ${text(r.time)}` : join([text(r.date), text(r.time)], " ");
      const repeat = text(r.repeat);
      return join([text(r.title), when, repeat ? `repeats ${repeat}` : ""], " ");
    });
  if (reminders.length) lines.push(`Reminders: ${reminders.join("; ")}`);

  const budgets = list(s.budgets).map((b) => {
    const cat = text(b.category);
    if (!cat) return "";
    return `${cat} ${money(b.spent)}/${money(b.limit)}`;
  });
  const tx = list(s.transactions)
    .slice(0, 4)
    .map((t) => join([text(t.label), money(t.amount), text(t.category), text(t.when)], " "));
  const moneyLine = join(
    [budgets.filter(Boolean).length ? `Money: ${join(budgets)}` : "", tx.length ? `Last: ${tx.join("; ")}` : ""],
    ". ",
  );
  if (moneyLine) lines.push(moneyLine);

  const journal = list(s.journal)[0];
  if (journal) {
    const title = text(journal.title);
    const body = firstLine(journal.body);
    const bit = join([title, body], " — ");
    if (bit) lines.push(`Journal: ${bit}`);
  }

  // Saved notes were left out entirely, so CAVEN would take a note, confirm it,
  // and then say he could not see the contents of his own notes when asked.
  // He can read them now; he still must not invent one that isn't here.
  const kept = list(s.voiceNotes)
    .slice(0, 4)
    .map((n) => {
      const body = firstLine(n.text, 70);
      if (!body) return "";
      const at = parseStamp(n.at ?? n.when);
      return at ? `${body} (${dayLabel(at, now)})` : body;
    })
    .filter(Boolean);
  if (kept.length) lines.push(`Notes: ${kept.join("; ")}`);

  const notes = (Array.isArray(s.brainNotes) ? s.brainNotes : [])
    .map((n) => text(n))
    .filter(Boolean)
    .slice(0, 4);
  if (notes.length) lines.push(`Brain: ${notes.join("; ")}`);

  if (!lines.length) return "";
  return `BOARD\n${lines.join("\n")}`;
}
