// Web Speech API + Web Audio wrappers with graceful fallback.

import { silenceMs } from '../../shared/endpoint';

type SR = typeof window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export function voiceSupported(): boolean {
  const w = window as SR;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

let recognition: any = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let rafId = 0;
let stream: MediaStream | null = null;

async function startMeter(onAmp: (a: number) => void) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      onAmp(Math.min(1, rms * 4));
      rafId = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    /* mic denied — recognition may still work; amplitude stays flat */
  }
}

function stopMeter() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  analyser = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

// Hands-free listening: the recogniser ends on end-of-utterance (continuous =
// false) and a silence timer backs that up on browsers that linger. onEnd fires
// as soon as the user stops talking — no second click required.
//
// How long that quiet gap runs is not a fixed number. It was 1800ms after any
// partial and a bare 400ms after the browser's own onspeechend, and a trailing
// "um—" reads to the recogniser exactly like the end of a sentence: the mic shut
// mid-thought and the fragment went off to be saved as a command. The gap is now
// decided per utterance by shared/endpoint.ts, which is patient with a filler or
// an unfinished clause and closes at once on "that's it".
const WRAP_WARN_MS = 700; // how long before the cutoff the UI is warned
const LEAD_IN_MS = 6000; // grace period before any speech has been heard
const MAX_UTTERANCE_MS = 20000; // hard ceiling so the mic never hangs open

let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let maxTimer: ReturnType<typeof setTimeout> | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let aborted = false;

function clearTimers() {
  if (silenceTimer) clearTimeout(silenceTimer);
  if (maxTimer) clearTimeout(maxTimer);
  if (warnTimer) clearTimeout(warnTimer);
  silenceTimer = null;
  maxTimer = null;
  warnTimer = null;
}

export function startListening(
  onPartial: (text: string, amp: number) => void,
  onEnd: (text: string) => void,
  onError: (fatal: boolean) => void,
  // Fired shortly before the silence cutoff closes the mic, and again with
  // false if the user starts speaking again. Lets the UI warn rather than
  // cutting someone off mid-thought with no signal at all.
  onWrapUp?: (soon: boolean) => void,
) {
  const w = window as SR;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return onError(true);

  // Tear down anything still running so we never stack two recognisers.
  try {
    recognition?.abort?.();
  } catch {
    /* noop */
  }

  aborted = false;
  recognition = new Ctor();
  recognition.lang = 'en-AU';
  recognition.interimResults = true;
  // The crux of the fix: end the utterance automatically instead of staying
  // open until a second click.
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let amp = 0;
  let finalText = '';
  let settled = false;
  startMeter((a) => (amp = a));

  const stopRecogniser = () => {
    try {
      recognition?.stop();
    } catch {
      /* noop */
    }
  };

  const armSilence = (ms: number) => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (warnTimer) clearTimeout(warnTimer);
    onWrapUp?.(false);
    silenceTimer = setTimeout(stopRecogniser, ms);
    // Warn just before the cutoff so a pause mid-sentence is visible, not fatal.
    if (ms > WRAP_WARN_MS) warnTimer = setTimeout(() => onWrapUp?.(true), ms - WRAP_WARN_MS);
  };

  /**
   * Re-arm the quiet gap for whatever has been heard so far.
   *
   * Three outcomes: nothing transcribed yet keeps the full lead-in, because
   * closing the mic on someone who has not managed a word is the rudest thing
   * this loop can do; an explicit "that's it" closes immediately; everything
   * else gets the patience shared/endpoint.ts thinks it deserves.
   */
  const armForSpeech = () => {
    if (!finalText) return armSilence(LEAD_IN_MS);
    const ms = silenceMs(finalText);
    if (ms > 0) return armSilence(ms);
    // Closing now. Only the gap timers go — maxTimer stays armed so a recogniser
    // that declines to stop is still capped rather than left holding the mic.
    if (silenceTimer) clearTimeout(silenceTimer);
    if (warnTimer) clearTimeout(warnTimer);
    silenceTimer = null;
    warnTimer = null;
    onWrapUp?.(false);
    stopRecogniser();
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimers();
    stopMeter();
    onWrapUp?.(false);
    if (aborted) return; // cancelled on purpose — swallow the utterance
    onEnd(finalText.trim());
  };

  recognition.onresult = (e: any) => {
    let text = '';
    for (let i = e.resultIndex ?? 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    // Some browsers replay earlier results; keep the longest read we have seen.
    finalText = text.trim() || finalText;
    onPartial(finalText, amp);
    armForSpeech();
  };

  // The browser thinks the utterance is over. It is often wrong — a pause for
  // breath looks identical — so this goes through the same judgement as a
  // partial rather than the old blanket 400ms.
  recognition.onspeechend = () => armForSpeech();

  recognition.onerror = (e: any) => {
    if (settled) return;
    const fatal = e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture';
    if (fatal) {
      settled = true;
      clearTimers();
      stopMeter();
      onError(true);
      return;
    }
    // 'no-speech' / 'aborted' / 'network': settle with whatever we captured.
    finish();
  };

  recognition.onend = () => finish();

  // If nothing at all is said, close the mic politely rather than hanging.
  armSilence(LEAD_IN_MS);
  maxTimer = setTimeout(stopRecogniser, MAX_UTTERANCE_MS);

  try {
    recognition.start();
  } catch {
    if (!settled) {
      settled = true;
      clearTimers();
      stopMeter();
      onError(true);
    }
  }
}

// Graceful stop — whatever was captured is still processed.
export function stopListening() {
  clearTimers();
  try {
    recognition?.stop();
  } catch {
    /* noop */
  }
  stopMeter();
}

// Hard cancel — the utterance is discarded and onEnd never fires.
export function abortListening() {
  aborted = true;
  clearTimers();
  try {
    recognition?.abort?.() ?? recognition?.stop?.();
  } catch {
    /* noop */
  }
  stopMeter();
}

import { apiFetch } from './backend';
import { isMuted } from './sfx';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Ask CAVEN for a live reply. Returns null on failure so the caller can fall
// back to a canned line rather than leaving the user without a response.
export async function askCaven(message: string, history: ChatTurn[] = []): Promise<string | null> {
  try {
    const res = await apiFetch('chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) throw new Error(`chat ${res.status}`);
    const data = await res.json();
    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    return reply || null;
  } catch (err) {
    console.warn('CAVEN chat failed, using fallback line:', err);
    return null;
  }
}

// Handle on the currently playing TTS, so a new turn can interrupt CAVEN.
let speaking: { stop: () => void } | null = null;

export function stopSpeaking() {
  try {
    speaking?.stop();
  } catch {
    /* noop */
  }
  speaking = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}

// Speak with CAVEN's ElevenLabs British voice via /api/tts.
// Falls back to the browser voice if the request fails. onAmp streams the
// live audio amplitude so the core reacts to the actual speech.
export async function speak(text: string, onAmp?: (a: number) => void): Promise<void> {
  // Muted means muted — including CAVEN's own voice, not just interface blips.
  // The reply still renders on screen, and we still hold the turn open for a
  // plausible reading time so the mic doesn't re-arm the instant we "finish".
  if (isMuted()) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(2600, 600 + text.length * 38)));
    onAmp?.(0);
    return;
  }
  try {
    const res = await apiFetch('tts', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);

    const buf = await res.arrayBuffer();
    await playWithMeter(buf, onAmp);
  } catch (err) {
    console.warn('ElevenLabs TTS failed, using browser voice:', err);
    await browserSpeak(text);
  } finally {
    onAmp?.(0);
  }
}

// Plays an audio buffer while reporting amplitude via an AnalyserNode.
function playWithMeter(buf: ArrayBuffer, onAmp?: (a: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) {
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' })));
      const done = () => {
        speaking = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      speaking = {
        stop: () => {
          audio.pause();
          done();
        },
      };
      audio.play().catch(done);
      return;
    }
    const ctx: AudioContext = new Ctx();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      speaking = null;
      ctx.close().catch(() => {});
      resolve();
    };
    ctx.decodeAudioData(
      buf.slice(0),
      (decoded) => {
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          onAmp?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
          raf = requestAnimationFrame(tick);
        };
        src.onended = () => {
          cancelAnimationFrame(raf);
          done();
        };
        speaking = {
          stop: () => {
            cancelAnimationFrame(raf);
            try {
              src.stop();
            } catch {
              /* already ended */
            }
            done();
          },
        };
        src.start();
        tick();
      },
      () => done(),
    );
  });
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setTimeout(resolve, Math.min(2600, 700 + text.length * 45));
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.9;
    const voices = synth.getVoices();
    const pref = voices.find((v) => /male|daniel|google uk english male|arthur/i.test(v.name));
    if (pref) u.voice = pref;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    setTimeout(resolve, 700 + text.length * 90);
  });
}
