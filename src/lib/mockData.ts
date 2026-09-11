// Mock data powering CAVEN's boards. All local; no backend this pass.

export type Task = { id: string; title: string; done: boolean; tag?: string; time?: string };
export type Habit = { id: string; name: string; streak: number; goal: number; done: boolean; icon: string };
export type Reminder = { id: string; title: string; date: string; time: string; note?: string; dueAt?: string; timezone?: string };
export type CalendarEvent = { id: string; title: string; time: string; kind: 'routine' | 'event' | 'reminder' };
export type VoiceNote = { id: string; text: string; when: string };
export type Transaction = { id: string; label: string; amount: number; category: string; when: string };
export type Budget = { id: string; category: string; spent: number; limit: number };
export type JournalEntry = { id: string; date: string; mood: string; title: string; body: string };
export type BrainMetric = { label: string; value: number; hint: string };

export const habits: Habit[] = [
  { id: 'h1', name: 'Morning water', streak: 12, goal: 30, done: true, icon: '💧' },
  { id: 'h2', name: 'Meds', streak: 8, goal: 30, done: true, icon: '💊' },
  { id: 'h3', name: 'Move 20 min', streak: 4, goal: 21, done: false, icon: '🏃' },
  { id: 'h4', name: 'Wind-down', streak: 6, goal: 30, done: false, icon: '🌙' },
];

export const tasks: Task[] = [
  { id: 't1', title: 'Reply to landlord', done: false, tag: 'admin', time: '10:00' },
  { id: 't2', title: 'Refill prescription', done: false, tag: 'health' },
  { id: 't3', title: 'Draft birthday message', done: true, tag: 'social' },
  { id: 't4', title: '15 min tidy — desk', done: false, tag: 'home' },
];

export const reminders: Reminder[] = [
  { id: 'r1', title: 'Dinner with Mom', date: 'Sep 5', time: '6:00 PM', note: 'Book the corner table' },
  { id: 'r2', title: 'Physio appointment', date: 'Sep 8', time: '2:30 PM' },
];

export const calendar: CalendarEvent[] = [
  { id: 'c1', title: 'Morning routine', time: '07:30', kind: 'routine' },
  { id: 'c2', title: 'Focus block', time: '10:00', kind: 'event' },
  { id: 'c3', title: 'Dinner with Mom', time: '18:00', kind: 'reminder' },
  { id: 'c4', title: 'Night routine', time: '22:00', kind: 'routine' },
];

export const voiceNotes: VoiceNote[] = [
  { id: 'v1', text: 'Idea: batch cook on Sundays so weeknights are easier.', when: '2h ago' },
  { id: 'v2', text: 'Remember the book Sam recommended — "Four Thousand Weeks".', when: 'Yesterday' },
];

export const transactions: Transaction[] = [
  { id: 'x1', label: 'Grocery run', amount: -42.18, category: 'Food', when: 'Today' },
  { id: 'x2', label: 'Coffee', amount: -4.5, category: 'Food', when: 'Today' },
  { id: 'x3', label: 'Salary', amount: 2400, category: 'Income', when: 'Sep 1' },
  { id: 'x4', label: 'Streaming', amount: -12.99, category: 'Subscriptions', when: 'Sep 2' },
];

export const budgets: Budget[] = [
  { id: 'b1', category: 'Food', spent: 218, limit: 400 },
  { id: 'b2', category: 'Transport', spent: 96, limit: 150 },
  { id: 'b3', category: 'Fun', spent: 140, limit: 120 },
  { id: 'b4', category: 'Subscriptions', spent: 46, limit: 60 },
];

export const journal: JournalEntry[] = [
  { id: 'j1', date: 'Sep 4', mood: '🙂', title: 'Small win', body: 'Got through the whole morning routine without getting stuck. Felt calm.' },
  { id: 'j2', date: 'Sep 3', mood: '😮‍💨', title: 'Scattered', body: 'Hard to start anything. Broke tasks into tiny steps and it helped a bit.' },
];

export const brainMetrics: BrainMetric[] = [
  { label: 'Satisfaction', value: 74, hint: 'Trending up this week' },
  { label: 'Happiness', value: 68, hint: 'Steady' },
  { label: 'Energy', value: 52, hint: 'Dips after 3pm' },
  { label: 'Goal momentum', value: 81, hint: 'Strong on health goals' },
];

export const interests = ['Space & astronomy', 'Cooking', 'Lo-fi music', 'Bouldering', 'Sci-fi novels', 'Woodworking'];

export const brainNotes = [
  'Focuses best in the morning — schedule demanding tasks before noon.',
  'Responds well to tiny first steps rather than big goals.',
  'Feels most satisfied on days with a completed wind-down routine.',
  'Prefers gentle, concrete reminders over open-ended nudges.',
];
