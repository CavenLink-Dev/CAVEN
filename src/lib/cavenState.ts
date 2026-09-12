import { useCallback, useRef, useState } from 'react';
import { addressOf, DEFAULT_ADDRESS } from '../../shared/address';
import { parseActions } from '../../shared/actions';
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

type Route = { kind: CardKind; title: string };

// Spoken only when Claude is unreachable. It must never claim to have done
// something — that was the old "added that to your tasks" bug.
const OFFLINE_LINE = (a: string) => `I'm afraid I've lost the thread there, ${a}. Do give me a moment and try again.`;
const NO_SPEECH_LINE = (a: string) => `This browser won't let me listen, I'm afraid, ${a}. Do type to me instead.`;

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
    re: /\b(my calendar|my schedule|my agenda|my diary|what'?s on (today|tomorrow|this week)|whats on (today|tomorrow|this week)|what have i got on)\b/i,
    kind: 'calendar',
    title: 'Today',
  },
  {
    re: /\b(journal|diary entry|log how i|write this down in my)\b/i,
    kind: 'journal',
    title: 'Journal',
  },
  {
    re: /\b(voice note|make a note|take a note|note this down|jot (this|that) down|remember that i)\b/i,
    kind: 'voicenote',
    title: 'Voice note',
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
  const { data, capture, perform } = useCavenStore();
  const [state, setState] = useState<CavenState>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(''); // CAVEN's latest spoken line, for the chat box
  const [locked, setLocked] = useState(false);
  const [conversing, setConversing] = useState(false); // mic loop is running
  const [wrapUp, setWrapUp] = useState(false); // mic is about to close on silence

  const lockedRef = useRef(false);
  const conversingRef = useRef(false);
  const stateRef = useRef<CavenState>('idle');
  const historyRef = useRef<ChatTurn[]>([]); // rolling conversation for continuity
  // Bumped whenever a turn is interrupted, so a stale async turn can't resume.
  const genRef = useRef(0);
  // Refreshed every render, so changing the form of address takes effect at once.
  const addressRef = useRef(DEFAULT_ADDRESS);
  addressRef.current = addressOf(data);

  // speak()/startListening() stream amplitude every animation frame. Writing
  // those into React state re-rendered the whole board (TopBar, MusicMenu, every
  // glass panel) and made the UI crawl. Instead the live value lives in a ref
  // that the core reads in its own rAF loop, so audio frames never re-render.
  const amplitudeRef = useRef(0);
  const pushAmp = useCallback((a: number) => {
    amplitudeRef.current = Number.isFinite(a) ? a : 0;
  }, []);
  const resetAmp = useCallback(() => {
    amplitudeRef.current = 0;
  }, []);

  const set = (s: CavenState) => {
    stateRef.current = s;
    setState(s);
  };

  // Refs let startMic and process reference each other without a circular
  // useCallback dependency (which breaks Fast Refresh and hook ordering).
  const startMicRef = useRef<() => void>(() => {});
  const processRef = useRef<(text: string) => void>(() => {});

  // Open the mic. It closes itself the moment the user stops talking.
  const startMic = useCallback(() => {
    setTranscript('');
    setWrapUp(false);
    playSfx('start');
    set('listening');

    if (!voiceSupported()) {
      conversingRef.current = false;
      setConversing(false);
      setReply(NO_SPEECH_LINE(addressRef.current));
      set('idle');
      return;
    }

    startListening(
      (partial, amp) => {
        setTranscript(partial);
        pushAmp(amp);
      },
      (final) => {
        setWrapUp(false);
        processRef.current(final);
      },
      (fatal) => {
        // Mic denied or unavailable — say so plainly and stand down rather
        // than pretending to have heard a command.
        if (!fatal) return;
        conversingRef.current = false;
        lockedRef.current = false;
        setConversing(false);
        setLocked(false);
        resetAmp();
        setReply(`I can't get at your microphone, ${addressRef.current}. Grant me access, or simply type it.`);
        set('idle');
      },
      (soon) => setWrapUp(soon),
    );
  }, [pushAmp, resetAmp]);
  startMicRef.current = startMic;

  // Re-open the mic after CAVEN finishes speaking, so it is a conversation.
  const rearm = useCallback(() => {
    setWrapUp(false);
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
        resetAmp();
        rearm();
        return;
      }

      setTranscript(said);
      setReply('');
      set('thinking');

      const r = route(said);
      let line = '';
      let changed = false;

      // Ask Claude, then honour whatever it proposed. parseActions runs on every
      // reply without exception, so a stray ACT block can never be read aloud.
      const converse = async () => {
        const raw = await askCaven(said, historyRef.current);
        if (!alive()) return;
        // Provider unreachable. Say so; never attempt actions on a turn we never had.
        if (raw === null) {
          line = OFFLINE_LINE(addressRef.current);
          return;
        }
        const { spoken, actions } = parseActions(raw);
        line = spoken;
        if (!actions.length) {
          if (!line) line = OFFLINE_LINE(addressRef.current);
          return;
        }
        try {
          const result = await perform(actions);
          if (!alive()) return;
          changed = result.changed;
          // Claude's own line is already in character, so speak it when the work
          // actually landed; fall back to the action's own words if it said nothing.
          if (!line) line = result.message;
        } catch (error) {
          // Nothing was saved. Whatever cheerful thing Claude wrote is now a lie,
          // so it is discarded and the user hears exactly what went wrong instead.
          changed = false;
          line = error instanceof Error ? error.message : `That did not save, ${addressRef.current}. Please retry.`;
        }
      };

      if (r) {
        // Regex fast path: a plain "remind me…" costs no tokens and still works.
        try {
          const result = await capture(r.kind, said);
          if (!alive()) return;
          changed = result.changed;
          if (changed) line = result.message;
          else await converse();
        } catch (error) {
          // The fast path refused — most often a date it couldn't read. Hand the
          // turn to the model rather than stopping here: it has the last few
          // turns of history, so a follow-up like "tomorrow at six" completes the
          // original request instead of dead-ending on a question nothing hears.
          const refusal = error instanceof Error ? error.message : '';
          await converse();
          if (!alive()) return;
          // Only fall back to the raw refusal if the model gave us nothing.
          if (!line) line = refusal || `That did not save, ${addressRef.current}. Please retry.`;
        }
      } else {
        await converse();
      }
      if (!alive()) return;

      setReply(line);
      const turns: ChatTurn[] = [
        { role: 'user', content: said },
        { role: 'assistant', content: line },
      ];
      historyRef.current = [...historyRef.current, ...turns].slice(-8);

      set('speaking');
      await speak(line, pushAmp);
      if (!alive()) return;

      if (changed) {
        set('complete');
        playSfx('success');
        await wait(500);
        if (!alive()) return;
      }

      set('idle');
      resetAmp();
      rearm();
    },
    [capture, perform, rearm, resetAmp],
  );
  processRef.current = process;

  // Typed commands take the same path, and interrupt whatever is in flight.
  const runCommand = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    genRef.current++;
    abortListening();
    stopSpeaking();
    resetAmp();
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
    resetAmp();
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

  return {
    state,
    amplitudeRef,
    transcript,
    reply,
    locked,
    conversing,
    wrapUp,
    toggle,
    toggleLock,
    cancel,
    runCommand,
  };
}
