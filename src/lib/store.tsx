import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from './backend';
import type { CardKind } from './cavenState';
import {
  brainMetrics,
  brainNotes,
  budgets,
  calendar,
  habits,
  interests,
  journal,
  reminders,
  tasks,
  transactions,
  voiceNotes,
  type BrainMetric,
  type Budget,
  type CalendarEvent,
  type Habit,
  type JournalEntry,
  type Reminder,
  type Task,
  type Transaction,
  type VoiceNote,
} from './mockData';

export type CavenData = {
  tasks: Task[];
  habits: Habit[];
  reminders: Reminder[];
  calendar: CalendarEvent[];
  voiceNotes: VoiceNote[];
  transactions: Transaction[];
  budgets: Budget[];
  journal: JournalEntry[];
  brainMetrics: BrainMetric[];
  interests: string[];
  brainNotes: string[];
};

export const seedData = (): CavenData => ({
  tasks,
  habits,
  reminders,
  calendar,
  voiceNotes,
  transactions,
  budgets,
  journal,
  brainMetrics,
  interests,
  brainNotes,
});

type Store = {
  data: CavenData;
  ready: boolean;
  update: (patch: Partial<CavenData> | ((prev: CavenData) => CavenData)) => void;
  capture: (kind: CardKind, text: string) => void;
};

const StoreContext = createContext<Store | null>(null);

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CavenStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CavenData>(seedData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('state');
        if (!res.ok) throw new Error(`state ${res.status}`);
        const body = await res.json();
        if (!cancelled && body?.state && typeof body.state === 'object') {
          setData({ ...seedData(), ...body.state });
        } else if (!cancelled) {
          const seed = seedData();
          setData(seed);
          await apiFetch('state', { method: 'POST', body: JSON.stringify({ state: seed }) });
        }
      } catch (err) {
        console.warn('CAVEN state load failed, using local seed:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: CavenData) => {
    apiFetch('state', { method: 'POST', body: JSON.stringify({ state: next }) }).catch((err) => {
      console.warn('CAVEN state save failed:', err);
    });
  }, []);

  const update = useCallback(
    (patch: Partial<CavenData> | ((prev: CavenData) => CavenData)) => {
      setData((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const capture = useCallback(
    (kind: CardKind, text: string) => {
      const said = text.trim();
      if (!said) return;
      update((prev) => {
        if (kind === 'reminder') {
          const item: Reminder = { id: nextId('r'), title: said.replace(/^remind me( to)?\s*/i, ''), date: todayLabel(), time: 'Soon' };
          return { ...prev, reminders: [item, ...prev.reminders] };
        }
        if (kind === 'tasks') {
          const item: Task = { id: nextId('t'), title: said, done: false };
          return { ...prev, tasks: [item, ...prev.tasks] };
        }
        if (kind === 'journal') {
          const item: JournalEntry = { id: nextId('j'), date: todayLabel(), mood: '🙂', title: 'Voice entry', body: said };
          return { ...prev, journal: [item, ...prev.journal] };
        }
        if (kind === 'voicenote') {
          const item: VoiceNote = { id: nextId('v'), text: said, when: 'Just now' };
          return { ...prev, voiceNotes: [item, ...prev.voiceNotes] };
        }
        if (kind === 'calendar') {
          const item: CalendarEvent = { id: nextId('c'), title: said, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), kind: 'event' };
          return { ...prev, calendar: [item, ...prev.calendar] };
        }
        if (kind === 'brain') {
          return { ...prev, brainNotes: [said, ...prev.brainNotes].slice(0, 12) };
        }
        return prev;
      });
    },
    [update],
  );

  const value = useMemo(() => ({ data, ready, update, capture }), [data, ready, update, capture]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCavenStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useCavenStore must be used within CavenStoreProvider');
  return ctx;
}
