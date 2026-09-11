import { useCallback, useRef, useState } from 'react';
import { playSfx } from './sfx';
import { useCavenStore } from './store';
import {
  abortListening,
  askCaven,
  speak,
  startListening,
  stopSpeaking,
  voiceSupported,
  type ChatTurn,
} from './voice';

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

type Route = { kind: CardKind; title: string };

// Spoken only when Claude is unreachable. It must never claim to have done
// something — that was the old "added that to your tasks" bug.
const OFFLINE_LINE = "Ah — I've lost the thread of you there. Give me a second and try again.";
const NO_SPEECH_LINE = "This browser won't let me listen, I'm afraid. Type to me instead.";

// Plain conversation. If it looks like this, CAVEN just talks; no card, no capture.
const CHITCHAT =
  /^\s*(hey|hi|hiya|hello|yo|oi|sup|morning|evening|afternoon|good (morning|afternoon|evening|night)|how (are|is|'?s|s) (you|it going|things|we)|how (you|ya|u) (going|doing|been)|how'?s it going|what'?s up|whats up|you (there|alright|ok)|are you (there|awake|listening)|thanks|thank you|cheers|nice one|well done|lovely|ok|okay|cool|right|nothing|never ?mind|forget it|stop|who are you|what are you|what can you do|tell me a joke|say something|talk to me|test|testing)\b/i;

// Explicit intent only — each pattern needs the user to actually ask for the thing.
const INTENTS: Array<{ re: RegExp; kind: CardKind; title: string }> = [
  {
    re: /\b(remind me|set a reminder|reminder for|don'?t let me forget|dont let me forget|nudge me|wake me)\b/i,
    kind: 'reminder',
    title: 'Reminder set',
  },
  {
    re: /\b(add (a |an )?task|new task|another task|to-?do list|my tasks|task list|add .+ to my (list|tasks)|put .+ on my list|tick .+ off|cross .+ off)\b/i,
    kind: 'tasks',
    title: 'Tasks',
  },
  {
    re: /\b(my habits|habit tracker|show me my habits|my streaks?|check my streak|did i (take|drink|do) my)\b/i,
    kind: 'habits',
    title: 'Habits',
  },
  {
    re: /\b(my calendar|my schedule|my agenda|my diary|what'?s on (today|tomorrow|this week)|whats on (today|tomorrow|this week)|what have i got on|book .+ (for|on|at)|schedule .+ (for|on|at))\b/i,
    kind: 'calendar',
    title: 'Today',
  },
  {
    re: /\b(journal|diary entry|log how i|write this down in my)\b/i,
    kind: 'journal',
    title: 'Journal',
  },
  {
    re: /\b(my budget|my finances|my spending|how much (did|have) i (spend|spent)|my expenses|my transactions|my bank balance|what did i spend)\b/i,
    kind: 'finance',
    title: 'Finances',
  },
  {
    re: /\b(voice note|make a note|take a note|note this down|jot (this|that) down|remember that i)\b/i,
    kind: 'voicenote',
    title: 'Voice note',
  },
  {
    re: /\b(caven brain|my brain|what do you know about me|my profile|my interests)\b/i,
    kind: 'brain',
    title: 'CAVEN Brain',
  },
];

// Returns null for conversation — the overwhelming majority of what gets said.
export function route(text: string): Route | null {
  const t = text.trim();
  if (!t) return null;
  // A bare greeting is never a command, even if it happens to contain a keyword.
  if (CHITCHAT.test(t) && t.split(/\s+/).length <= 6) return null;
  for (const intent of INTENTS) {
    if (intent.re.test(t)) return { kind: intent.kind, title: intent.title };
  }
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCaven() {
  const { capture } = useCavenStore();
  const [state, setState] = useState<CavenState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(''); // CAVEN's latest spoken line, for the chat box
  const [locked, setLocked] = useState(false);
  const [conversing, setConversing] = useState(false); // mic loop is running
  const [cards, setCards] = useState<CardInstance[]>([]);

  const lockedRef = useRef(false);
  const conversingRef = useRef(false);
  const stateRef = useRef<CavenState>('idle');
  const historyRef = useRef<ChatTurn[]>([]); // rolling conversation for continuity
  // Bumped whenever a turn is interrupted, so a stale async turn can't resume.
  const genRef = useRef(0);

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

  // Open the mic. It closes itself the moment the user stops talking.
  const startMic = useCallback(() => {
    setTranscript('');
    playSfx('start');
    set('listening');

    if (!voiceSupported()) {
      conversingRef.current = false;
      setConversing(false);
      setReply(NO_SPEECH_LINE);
      set('idle');
      return;
    }

    startListening(
      (partial, amp) => {
        setTranscript(partial);
        setAmplitude(amp);
      },
      (final) => processRef.current(final),
      (fatal) => {
        // Mic denied or unavailable — say so plainly and stand down rather
        // than pretending to have heard a command.
        if (!fatal) return;
        conversingRef.current = false;
        lockedRef.current = false;
        setConversing(false);
        setLocked(false);
        setAmplitude(0);
        setReply("Can't get at your microphone, Keanu. Let me in, or just type it.");
        set('idle');
      },
    );
  }, []);
  startMicRef.current = startMic;

  // Re-open the mic after CAVEN finishes speaking, so it is a conversation.
  const rearm = useCallback(() => {
    if (!conversingRef.current && !lockedRef.current) return;
    // Small gap so the tail of CAVEN's own voice isn't captured as input.
    setTimeout(() => {
      if ((conversingRef.current || lockedRef.current) && stateRef.current === 'idle') startMicRef.current();
    }, 400);
  }, []);

  // One full turn: hear → Claude → (maybe) card → speak → listen again.
  const process = useCallback(
    async (text: string) => {
      const gen = ++genRef.current;
      const alive = () => genRef.current === gen;
      const said = text.trim();

      if (!said) {
        // Heard nothing at all. Don't nag — just open the ear again.
        set('idle');
        setAmplitude(0);
        rearm();
        return;
      }

      setTranscript(said);
      setReply('');
      set('thinking');

      // The spoken line always comes from Claude. Keyword routing only decides
      // whether a card is worth surfacing alongside it.
      const [live] = await Promise.all([askCaven(said, historyRef.current), wait(320)]);
      if (!alive()) return;
      const line = live ?? OFFLINE_LINE;

      // Only surface/capture when the user clearly asked for it, and never on
      // a failed turn — a card would imply CAVEN understood when it didn't.
      const r = live ? route(said) : null;
      if (r) {
        set('acting');
        await wait(600);
        if (!alive()) return;
        surface(r, said);
        capture(r.kind, said);
        playSfx('notification');
      }

      setReply(line);
      const turns: ChatTurn[] = [
        { role: 'user', content: said },
        { role: 'assistant', content: line },
      ];
      historyRef.current = [...historyRef.current, ...turns].slice(-8);

      set('speaking');
      await speak(line, setAmplitude);
      if (!alive()) return;

      if (r) {
        set('complete');
        playSfx('success');
        await wait(500);
        if (!alive()) return;
      }

      set('idle');
      setAmplitude(0);
      rearm();
    },
    [surface, capture, rearm],
  );
  processRef.current = process;

  // Typed commands take the same path, and interrupt whatever is in flight.
  const runCommand = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    genRef.current++;
    abortListening();
    stopSpeaking();
    setAmplitude(0);
    processRef.current(said);
  }, []);

  // Stop everything: cancel the turn, close the mic, hush the voice.
  const endConversation = useCallback(() => {
    genRef.current++;
    conversingRef.current = false;
    setConversing(false);
    abortListening();
    stopSpeaking();
    set('idle');
    setAmplitude(0);
    setTranscript('');
  }, []);

  // Single click on the core: start talking, or stop the whole conversation.
  const toggle = useCallback(() => {
    if (conversingRef.current || stateRef.current !== 'idle') {
      playSfx('off');
      endConversation();
      return;
    }
    conversingRef.current = true;
    setConversing(true);
    startMic();
  }, [startMic, endConversation]);

  // Double click: lock into always-on background listening (house speaker).
  const toggleLock = useCallback(() => {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
    if (next) {
      conversingRef.current = true;
      setConversing(true);
      if (stateRef.current === 'idle') startMic();
    } else {
      endConversation();
    }
  }, [startMic, endConversation]);

  const cancel = useCallback(() => {
    playSfx('fade');
    lockedRef.current = false;
    setLocked(false);
    endConversation();
  }, [endConversation]);

  const updateCard = useCallback((id: string, patch: Partial<CardInstance>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const closeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    state,
    amplitude,
    transcript,
    reply,
    locked,
    conversing,
    cards,
    toggle,
    toggleLock,
    cancel,
    updateCard,
    closeCard,
    runCommand,
  };
}
