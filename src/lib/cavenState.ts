import { useCallback, useEffect, useRef, useState } from 'react';
import { addressOf, DEFAULT_ADDRESS } from '../../shared/address';
import { claimsChange, parseActions, REMOVAL, type CavenAction } from '../../shared/actions';
import { isCancel } from '../../shared/cancel';
import { asksToStay, elapsedLine, stayingLine } from '../../shared/companion';
import { ASKS_FIRST_TASK, ASKS_FOR_THE_DAY, firstTaskLine, readTheDay } from '../../shared/daySpeak';
import { confirmLine, countWord, isAffirmative, isNegative, readDump } from '../../shared/dump';
import { isFragment } from '../../shared/endpoint';
import { dueLine, nextDue, settle } from '../../shared/reminders';
import { spendCheck } from '../../shared/spendCheck';
import { showLocalNotification } from './push';
import { playSfx } from './sfx';
import { useCavenStore, type CavenData } from './store';
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
/**
 * Spoken when the model announced a change that never happened. It says plainly
 * that nothing was written rather than papering over it, because the one thing
 * the board must never do is disagree with what he just said.
 */
const NOTHING_DONE = (a: string) => `Nothing was saved, ${a}. Say it again plainly and I'll see to it.`;
const NO_SPEECH_LINE = (a: string) => `This browser won't let me listen, I'm afraid, ${a}. Do type to me instead.`;

/**
 * Said when he calls a turn off.
 *
 * Several of them, and never the same one twice running: the whole difference
 * between a person and a machine is that a person does not say "Very good" in
 * precisely the same tone five times in a row. None of these claims anything was
 * undone, because a cancelled turn never started.
 */
const LEFT_IT = ['All right.', 'Left it.', 'Very good.', 'As you were.', 'Right you are.'] as const;

/**
 * What the current conversation is in the middle of.
 *
 * In memory and in this tab only — never persisted, never on caven_boards. The
 * point is that "done", "skip" and "save that" answer from here rather than the
 * model inferring the state of play from eight turns of chat history.
 */
type VoiceSession = {
  /** A question he was asked and has not answered yet. */
  pendingClarification: string | null;
  /** Errands read back and waiting on a yes. Nothing is written until one comes. */
  pendingConfirmation: string[] | null;
  /** Whether the last turn actually wrote to the board. */
  lastActionChanged: boolean;
  /** When he stops being sat with, and the length he asked for so it can be said back. */
  companionUntil: number | null;
  companionMinutes: number | null;
  /** The routine step he is on — unused until routines land. */
  routine: { id: string; step: number } | null;
};

const freshSession = (): VoiceSession => ({
  pendingClarification: null,
  pendingConfirmation: null,
  lastActionChanged: false,
  companionUntil: null,
  companionMinutes: null,
  routine: null,
});

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
    // "what's on today" raised the board; "what is on today" did not, because the
    // contraction was required. Same question, and the uncontracted form is the
    // one speech recognition tends to produce.
    re: /\b(my calendar|my schedule|my agenda|my diary|what(?:'?s|s| is| was) on (today|tomorrow|this week)|what (?:have i got|do i have|is) on|anything on (today|tomorrow))\b/i,
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
  // Nor is "delete the reminder for 6:26pm" a request for a reminder, however
  // much it reads like one. Removal belongs to the model, which owns the delete
  // verbs and asks which record was meant instead of guessing.
  if (REMOVAL.test(t)) return null;
  for (const intent of INTENTS) {
    if (intent.re.test(t)) return { kind: intent.kind, title: intent.title };
  }
  return null;
}

/**
 * Questions the board can answer on its own.
 *
 * No round trip, no tokens, and — the point — no chance of a plausible
 * invention: every figure and every name traces to a row he saved. Null means
 * this was not one of those questions, or the board had nothing worth saying,
 * and the model takes the turn as usual.
 */
function boardAnswer(said: string, data: CavenData, now: Date): string | null {
  const spend = spendCheck(data, said);
  if (spend) return spend;
  if (ASKS_FOR_THE_DAY.test(said)) return readTheDay(data, now);
  if (ASKS_FIRST_TASK.test(said)) return firstTaskLine(data);
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How often the open tab looks for a reminder that has come due. */
const DUE_SWEEP_MS = 20_000;

/** How often the companion deadline is checked. Coarse on purpose — it is company, not a stopwatch. */
const COMPANION_TICK_MS = 15_000;

export function useCaven() {
  const { data, capture, perform, update } = useCavenStore();
  const [state, setState] = useState<CavenState>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(''); // CAVEN's latest spoken line, for the chat box
  const [locked, setLocked] = useState(false);
  const [conversing, setConversing] = useState(false); // mic loop is running
  const [wrapUp, setWrapUp] = useState(false); // mic is about to close on silence
  // Bumped whenever the board is worth putting on screen. Two occasions: a turn
  // actually wrote something, or he asked about the board itself. The second one
  // matters — without it "what's on today?" changes nothing, so the board would
  // never appear, and there would be no way to look at it at all.
  const [boardCue, setBoardCue] = useState(0);

  const lockedRef = useRef(false);
  const conversingRef = useRef(false);
  const stateRef = useRef<CavenState>('idle');
  const historyRef = useRef<ChatTurn[]>([]); // rolling conversation for continuity
  // Bumped whenever a turn is interrupted, so a stale async turn can't resume.
  const genRef = useRef(0);
  // Refreshed every render, so changing the form of address takes effect at once.
  const addressRef = useRef(DEFAULT_ADDRESS);
  addressRef.current = addressOf(data);
  // Same reason as addressRef: process() is a useCallback, and a stale closure
  // here would answer "what am I doing first?" from whatever the board held when
  // the callback was made rather than what is on it now.
  const dataRef = useRef(data);
  dataRef.current = data;

  const session = useRef<VoiceSession>(freshSession());

  // Pick a line, but not the one just used. Cheap, and it is the difference
  // between a butler and an answering machine.
  const lastAside = useRef(-1);
  const aside = useCallback((lines: readonly string[]) => {
    let i = Math.floor(Math.random() * lines.length);
    if (i === lastAside.current) i = (i + 1) % lines.length;
    lastAside.current = i;
    return lines[i]!;
  }, []);

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

      // A fragment: fillers, or an opening with nothing after it. The mic waits
      // these out now (shared/endpoint.ts), but a recogniser can still hand one
      // over — an "um" on its own used to go off to the model, which would
      // helpfully invent something to do with it. Treated exactly like having
      // heard nothing: no reply, no card, the ear simply opens again.
      //
      // Unless he was asked a question. An answer to a question is never a
      // fragment to be thrown away, however short it is.
      if (!session.current.pendingClarification && isFragment(said)) {
        set('idle');
        resetAmp();
        rearm();
        return;
      }

      setTranscript(said);
      setReply('');
      set('thinking');

      // Called off. Nothing is written, nothing is asked of the model and no card
      // opens — a turn he cancelled should cost him nothing at all. Only the whole
      // utterance counts: "never mind the dentist reminder" is a deletion, and
      // shared/cancel.ts is careful about the difference.
      if (isCancel(said, addressRef.current)) {
        session.current.pendingClarification = null;
        session.current.pendingConfirmation = null;
        session.current.companionUntil = null;
        session.current.companionMinutes = null;
        const dropped = aside(LEFT_IT);
        setReply(dropped);
        set('speaking');
        await speak(dropped, pushAmp);
        if (!alive()) return;
        set('idle');
        resetAmp();
        rearm();
        return;
      }

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
          // Nothing was asked of the engine, so nothing changed. If the model
          // nevertheless announced that it had, that sentence is false and must
          // not be spoken — this is the path that once said "Removed." while the
          // reminder stayed exactly where it was.
          if (claimsChange(line)) line = NOTHING_DONE(addressRef.current);
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
          // The engine ran but wrote nothing — a no-op, not an error, so the catch
          // below never sees it. Its own message says what really happened ("I have
          // that one already"), and it outranks any claim to the contrary.
          else if (!changed && claimsChange(line)) line = result.message || NOTHING_DONE(addressRef.current);
        } catch (error) {
          // Nothing was saved. Whatever cheerful thing Claude wrote is now a lie,
          // so it is discarded and the user hears exactly what went wrong instead.
          changed = false;
          line = error instanceof Error ? error.message : `That did not save, ${addressRef.current}. Please retry.`;
        }
      };

      // What he was asked to confirm last turn. Taken now whatever happens next,
      // because a yes, a no and a change of subject all end the question — being
      // stuck in it is worse than losing it.
      const queued = session.current.pendingConfirmation;
      session.current.pendingConfirmation = null;

      if (queued && isNegative(said)) {
        line = aside(LEFT_IT);
      } else if (queued && isAffirmative(said)) {
        // Only here, on an explicit yes, does thinking aloud become rows.
        try {
          const result = await perform(queued.map((title): CavenAction => ({ do: 'task.add', title })));
          if (!alive()) return;
          changed = result.changed;
          line = changed
            ? `That's ${countWord(queued.length)} on your list.`
            : result.message || NOTHING_DONE(addressRef.current);
        } catch (error) {
          changed = false;
          line = error instanceof Error ? error.message : `That did not save, ${addressRef.current}. Please retry.`;
        }
      } else if (r) {
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
        // Straight off the board where it can be. Only when route() found no
        // card, so what opens on screen stays decided by the existing intents.
        const answer = boardAnswer(said, dataRef.current, new Date());
        const minutes = asksToStay(said);
        // Thinking aloud. Read back and held, not saved — the confirmation is
        // enforced here rather than asked of the model, because a prompt is a
        // request and this needs to be a rule.
        const dump = answer || minutes ? null : readDump(said);

        if (answer) {
          line = answer;
        } else if (minutes) {
          session.current.companionUntil = Date.now() + minutes * 60_000;
          session.current.companionMinutes = minutes;
          line = stayingLine(minutes);
        } else if (dump) {
          session.current.pendingConfirmation = dump;
          line = confirmLine(dump);
        } else {
          await converse();
        }
      }
      if (!alive()) return;

      setReply(line);
      // What "that" refers to next turn. Recorded here, where the engine's own
      // answer is in hand, rather than inferred later from the wording of a line.
      session.current.lastActionChanged = changed;
      // A board intent counts even when nothing was written: asking what is on
      // today is exactly when you want to see it.
      if (changed || r) setBoardCue((n) => n + 1);
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
    [aside, capture, perform, rearm, resetAmp],
  );
  processRef.current = process;

  // A reminder that comes due while the app is open announces itself.
  //
  // Nothing announced one before: it reached its time and carried on sitting
  // there as an ordinary row. This is the in-app half — push (api/push-dispatch)
  // is what reaches a closed tab — and both settle the reminder the same way,
  // through shared/reminders.ts, so a repeating one rolls on exactly once.
  const announced = useRef(new Set<string>());
  const announcing = useRef(false);
  useEffect(() => {
    let live = true;

    const sweep = async () => {
      // Never cut across a turn. CAVEN finishes what he is saying first, and the
      // reminder waits for the next sweep — it is already late, a few seconds
      // more costs nothing, and talking over himself would cost a great deal.
      if (!live || announcing.current || stateRef.current !== 'idle') return;
      const now = new Date();
      const due = nextDue(data.reminders, now);
      if (!due) return;

      // Keyed by the occurrence, not the reminder, so a repeating one can come
      // round again — and so a failed save can't put us in an announcing loop.
      const key = `${due.id}@${due.dueAt ?? ''}`;
      if (announced.current.has(key)) return;
      announced.current.add(key);
      announcing.current = true;

      try {
        const settled = settle(due, now);
        void update((prev) => ({
          ...prev,
          reminders: prev.reminders.map((r) => (r.id === due.id ? { ...r, ...settled } : r)),
        }));

        const line = dueLine(due, now, addressRef.current);
        setReply(line);
        playSfx('success');
        // Only when the tab isn't the thing being looked at; on screen, the
        // spoken line and the board are the notification.
        showLocalNotification(due, now);

        set('speaking');
        await speak(line, pushAmp);
        if (!live) return;
        set('idle');
        resetAmp();
        // Back to listening only if he was already in a conversation.
        rearm();
      } finally {
        announcing.current = false;
      }
    };

    void sweep();
    const id = window.setInterval(() => void sweep(), DUE_SWEEP_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [data.reminders, update, pushAmp, rearm, resetAmp]);

  // Sitting with him for a stretch he asked for.
  //
  // Mostly this does nothing, which is the point: a companion that pipes up
  // every few minutes is an egg timer with opinions. It says one line when the
  // time is up and then forgets itself. No push and no reminder row — a closed
  // tab is not someone to sit with, and this is not something to be woken for.
  const companionSpeaking = useRef(false);
  useEffect(() => {
    let live = true;

    const check = async () => {
      if (!live || companionSpeaking.current) return;
      const until = session.current.companionUntil;
      if (!until || Date.now() < until) return;

      const clear = () => {
        session.current.companionUntil = null;
        session.current.companionMinutes = null;
      };

      // He has gone. Nothing to say, and nobody to say it to.
      if (!conversingRef.current && !lockedRef.current) return clear();
      // Mid-turn. It keeps until the next tick; talking over himself would not.
      if (stateRef.current !== 'idle') return;

      const minutes = session.current.companionMinutes ?? 0;
      clear();
      companionSpeaking.current = true;
      try {
        const line = elapsedLine(minutes);
        setReply(line);
        set('speaking');
        await speak(line, pushAmp);
        if (!live) return;
        set('idle');
        resetAmp();
        rearm();
      } finally {
        companionSpeaking.current = false;
      }
    };

    const id = window.setInterval(() => void check(), COMPANION_TICK_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [pushAmp, rearm, resetAmp]);

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
    boardCue,
    toggle,
    toggleLock,
    cancel,
    runCommand,
  };
}
