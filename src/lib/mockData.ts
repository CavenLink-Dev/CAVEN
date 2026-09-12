// Types for the private board. Seed values live in the signed-in store, not here.
//
// Several rows carry both a human string (`when`, `date`, `time`) and an ISO
// stamp (`at`, `dueAt`). The string is what the board prints and CAVEN speaks;
// the stamp is what anything comparing days or months must use. Stamps are
// optional because rows written before they existed are still in live boards —
// shared/when.ts parses those older strings rather than discarding them.

import type { Repeat } from '../../shared/when';

export type Task = { id: string; title: string; done: boolean; tag?: string; time?: string };
/** `lastDone` is the local YYYY-MM-DD a habit was last ticked; `done` is derived from it. */
export type Habit = { id: string; name: string; streak: number; goal: number; done: boolean; icon: string; lastDone?: string };
export type Reminder = {
  id: string;
  title: string;
  date: string;
  time: string;
  note?: string;
  dueAt?: string;
  timezone?: string;
  /** Set when the reminder repeats; `dueAt` then holds the *next* occurrence. */
  repeat?: Repeat;
  /** ISO stamp of the moment this reminder was last announced. */
  firedAt?: string;
};
export type CalendarEvent = { id: string; title: string; time: string; kind: 'routine' | 'event' | 'reminder'; at?: string };
export type VoiceNote = { id: string; text: string; when: string; at?: string };
export type Transaction = { id: string; label: string; amount: number; category: string; when: string; at?: string };
export type Budget = { id: string; category: string; spent: number; limit: number };
export type JournalEntry = { id: string; date: string; mood: string; title: string; body: string; at?: string };
export type BrainMetric = { label: string; value: number; hint: string };
