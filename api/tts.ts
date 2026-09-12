import { EDWARD_VOICE, PREMADE_VOICE, json, authenticate, apiError } from "./_caven.js";
import { fallbackVoice } from "../shared/ttsVoice.js";

export const config = { runtime: "edge" };

// Remember a working voice on this isolate so we don't pay a 402 on every turn.
let stickyVoice = EDWARD_VOICE;

function elevenLabsRequest(apiKey: string, voiceId: string, text: string) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.75,
        style: 0.45,
        use_speaker_boost: true,
      },
    }),
  });
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    await authenticate(req);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return json({ error: "tts_unavailable" }, 502);

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if(text.length>4000) return json({error:"Text too long"},413);
    if (!text) return json({ error: "text required" }, 400);

    let voiceId = stickyVoice;
    let res = await elevenLabsRequest(apiKey, voiceId, text);

    if (!res.ok) {
      const detail = await res.text();
      console.error("ElevenLabs tts failed:", res.status, detail);
      const retryId = fallbackVoice(voiceId, res.status, PREMADE_VOICE);
      if (!retryId) return json({ error: "tts_unavailable" }, 502);
      voiceId = retryId;
      res = await elevenLabsRequest(apiKey, voiceId, text);
      if (!res.ok) {
        console.error("ElevenLabs premade retry failed:", res.status, await res.text());
        return json({ error: "tts_unavailable" }, 502);
      }
    }

    stickyVoice = voiceId;
    return new Response(res.body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("CAVEN tts failed:", err);
    return apiError(err);
  }
}
