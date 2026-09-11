// Web Speech API + Web Audio wrappers with graceful fallback.

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

// Click-to-talk: mic stays open until stopListening() is called, then onEnd
// fires with whatever was captured.
export function startListening(
  onPartial: (text: string, amp: number) => void,
  onEnd: (text: string) => void,
  onError: (fatal: boolean) => void,
) {
  const w = window as SR;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return onError(true);

  recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;

  let amp = 0;
  let finalText = '';
  // Guard so error+end don't both settle (which would double-process).
  let settled = false;
  startMeter((a) => (amp = a));

  const finish = () => {
    if (settled) return;
    settled = true;
    stopMeter();
    onEnd(finalText.trim());
  };

  recognition.onresult = (e: any) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    finalText = text;
    onPartial(text, amp);
  };
  recognition.onerror = (e: any) => {
    if (settled) return;
    // Permission/hardware denial is fatal — nothing will ever come through.
    const fatal = e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture';
    if (fatal) {
      settled = true;
      stopMeter();
      onError(true);
      return;
    }
    // Otherwise (e.g. no-speech, network) settle normally and process what we have.
    finish();
  };
  recognition.onend = () => finish();

  try {
    recognition.start();
  } catch {
    if (!settled) {
      settled = true;
      stopMeter();
      onError(true);
    }
  }
}

export function stopListening() {
  try {
    recognition?.stop();
  } catch {
    /* noop */
  }
  stopMeter();
}

import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3159d1b2`;
const TTS_URL = `${BASE}/tts`;
const CHAT_URL = `${BASE}/chat`;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Ask CAVEN for a live reply. Returns null on failure so the caller can fall
// back to a canned line rather than leaving the user without a response.
export async function askCaven(message: string, history: ChatTurn[] = []): Promise<string | null> {
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
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

// Speak with CAVEN's ElevenLabs (Edward) voice via the edge function.
// Falls back to the browser voice if the request fails. onAmp streams the
// live audio amplitude so the core reacts to the actual speech.
export async function speak(text: string, onAmp?: (a: number) => void): Promise<void> {
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
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
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
      return;
    }
    const ctx: AudioContext = new Ctx();
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
          ctx.close().catch(() => {});
          resolve();
        };
        src.start();
        tick();
      },
      () => {
        ctx.close().catch(() => {});
        resolve();
      },
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
