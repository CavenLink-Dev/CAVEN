// Types for the private board. Seed values live in the signed-in store, not here.

export type Task = { id: string; title: string; done: boolean; tag?: string; time?: string };
export type Habit = { id: string; name: string; streak: number; goal: number; done: boolean; icon: string };
export type Reminder = { id: string; title: string; date: string; time: string; note?: string; dueAt?: string; timezone?: string };
export type CalendarEvent = { id: string; title: string; time: string; kind: 'routine' | 'event' | 'reminder' };
export type VoiceNote = { id: string; text: string; when: string };
export type Transaction = { id: string; label: string; amount: number; category: string; when: string };
export type Budget = { id: string; category: string; spent: number; limit: number };
export type JournalEntry = { id: string; date: string; mood: string; title: string; body: string };
export type BrainMetric = { label: string; value: number; hint: string };
