import { useCallback, useRef, useState } from 'react';
import { playSfx } from './sfx';
import { useCavenStore } from './store';
import { askCaven, startListening, speak, stopListening, voiceSupported, type ChatTurn } from './voice';

export type CavenState = 'idle' | 'listening' | 'thinking' | 'acting' | 'speaking' | 'complete';

export type CardKind =
  | 'reminder'
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'voicenote'
  | 'finance'
  | 'journal'
  | 'brain';

export type CardInstance = {
  id: string;
  kind: CardKind;
  title: string;
  transcript?: string;
  minimized?: boolean;
  fullscreen?: boolean;
};

type Route = { kind: CardKind; title: string; reply: string };

const DEMO_COMMAND = 'Remind me on September 5th at 6pm — dinner with Mom.';

// Very small keyword router that maps a phrase to a card + spoken reply.
function route(text: string): Route {
  const t = text.toLowerCase();
  if (/remind|dinner|appointment|pick up|don't forget|dont forget/.test(t))
    return { kind: 'reminder', title: 'Reminder set', reply: "Done. I'll see that you're prompted in good time." };
  if (/spend|budget|money|finance|cost|paid|bought|bank/.test(t))
    return { kind: 'finance', title: 'Finances', reply: "Here is how the month stands. The overspend is the only figure that needs attention." };
  if (/journal|felt|feeling|mood|today was|write down/.test(t))
    return { kind: 'journal', title: 'Journal', reply: "Journal is open. Take your time." };
  if (/habit|streak|water|meds|routine/.test(t))
    return { kind: 'habits', title: 'Habits', reply: "Your habits are here. You are keeping them up rather well." };
  if (/calendar|schedule|agenda|today|tomorrow|events/.test(t))
    return { kind: 'calendar', title: 'Today', reply: "Here is how the day is arranged. I would notify you if anything collided." };
  if (/note|remember that|idea/.test(t))
    return { kind: 'voicenote', title: 'Voice note', reply: "Noted. I'll have it when you need it." };
  if (/brain|know about me|interests|about me/.test(t))
    return { kind: 'brain', title: 'CAVEN Brain', reply: "This is what I've come to understand about you." };
  return { kind: 'tasks', title: 'CAVEN', reply: "Good. I'm here. What would you like to deal with first?" };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCaven() {
  const { capture } = useCavenStore();
  const [state, setState] = useState<CavenState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(''); // CAVEN's latest spoken line, for the chat box
  const [locked, setLocked] = useState(false);
  const [cards, setCards] = useState<CardInstance[]>([]);

  const lockedRef = useRef(false);
  const stateRef = useRef<CavenState>('idle');
  const historyRef = useRef<ChatTurn[]>([]); // rolling conversation for continuity
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const set = (s: CavenState) => {
    stateRef.current = s;
    setState(s);
  };

  const surface = useCallback((r: Route, said: string) => {
    setCards((prev) => [...prev, { id: `${Date.now()}`, kind: r.kind, title: r.title, transcript: said }]);
  }, []);

  // Refs let startMic and process reference each other without a circular
  // useCallback dependency (which breaks Fast Refresh and hook ordering).
  const startMicRef = useRef<() => void>(() => {});
  const processRef = useRef<(text: string) => void>(() => {});

  // Open the mic (real or demo). Stays open until stopMic().
  const startMic = useCallback(() => {
    setTranscript('');
    setReply('');
    playSfx('start');
    set('listening');

    if (!voiceSupported()) {
      // Demo fallback: type out a scripted command, then process on stop.
      let i = 0;
      demoTimer.current = setInterval(() => {
        setAmplitude(0.4 + Math.random() * 0.6);
        setTranscript(DEMO_COMMAND.slice(0, (i += 2)));
        if (i >= DEMO_COMMAND.length && demoTimer.current) {
          clearInterval(demoTimer.current);
          demoTimer.current = null;
        }
      }, 55);
      return;
    }

    startListening(
      (partial, amp) => {
        setTranscript(partial);
        setAmplitude(amp);
      },
      (final) => processRef.current(final),
      (fatal) => {
        // Mic unavailable/denied (common in embedded previews): still respond,
        // so CAVEN never just sits on "Listening". Run the demo command.
        if (fatal) {
          setAmplitude(0);
          processRef.current(DEMO_COMMAND);
        }
      },
    );
  }, []);
  startMicRef.current = startMic;

  // Runs the full state sequence once a command is captured.
  const process = useCallback(
    async (text: string) => {
      const said = text.trim();
      if (!said) {
        // Heard nothing. Stay silent in background mode; otherwise reply politely.
        if (lockedRef.current) {
          set('idle');
          setAmplitude(0);
          startMicRef.current();
          return;
        }
        const line = "My apologies — I didn't quite catch that. Do try again.";
        setReply(line);
        set('speaking');
        await speak(line, setAmplitude);
        set('idle');
        setAmplitude(0);
        return;
      }
      setTranscript(said);
      const r = route(said);

      set('thinking');
      // Fetch CAVEN's live reply while the "thinking" beat plays. Keyword routing
      // still decides which card surfaces; the spoken line now comes from Claude.
      const [live] = await Promise.all([askCaven(said, historyRef.current), wait(1300)]);
      const line = live ?? r.reply;
      set('acting');
      await wait(1000);
      surface(r, said);
      capture(r.kind, said);
      playSfx('notification');
      setReply(line);
      // Remember the exchange (trimmed) so follow-ups have context.
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: said },
        { role: 'assistant', content: line },
      ].slice(-8);
      set('speaking');
      await speak(line, setAmplitude);
      set('complete');
      playSfx('success');
      await wait(700);
      set('idle');
      setAmplitude(0);
      // In locked/background mode, re-arm the mic automatically.
      if (lockedRef.current) startMicRef.current();
    },
    [surface, capture],
  );
  processRef.current = process;

  const runCommand = useCallback((text: string) => {
    if (stateRef.current !== 'idle') return;
    processRef.current(text);
  }, []);

  const stopMic = useCallback(() => {
    playSfx('off');
    if (demoTimer.current) {
      clearInterval(demoTimer.current);
      demoTimer.current = null;
      processRef.current(DEMO_COMMAND);
      return;
    }
    stopListening(); // triggers onEnd → process()
  }, []);

  // Single click on the core: toggle the mic.
  const toggle = useCallback(() => {
    if (stateRef.current === 'listening') stopMic();
    else if (stateRef.current === 'idle') startMic();
    // ignore clicks while thinking/acting/speaking
  }, [startMic, stopMic]);

  // Double click: lock into background listening mode (for a house speaker).
  const toggleLock = useCallback(() => {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
    if (next && stateRef.current === 'idle') startMic();
    if (!next && stateRef.current === 'listening') stopListening();
  }, [startMic]);

  const cancel = useCallback(() => {
    playSfx('fade');
    if (demoTimer.current) {
      clearInterval(demoTimer.current);
      demoTimer.current = null;
    }
    stopListening();
    lockedRef.current = false;
    setLocked(false);
    set('idle');
    setAmplitude(0);
    setTranscript('');
  }, []);

  const updateCard = useCallback((id: string, patch: Partial<CardInstance>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const closeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { state, amplitude, transcript, reply, locked, cards, toggle, toggleLock, cancel, updateCard, closeCard, runCommand };
}
