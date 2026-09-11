import { EDWARD_VOICE, json, authenticate, apiError } from "./_caven";

export const config = { runtime: "edge" };

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

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EDWARD_VOICE}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        // Override with ELEVENLABS_MODEL_ID (e.g. eleven_turbo_v2_5) if you
        // want lower latency; the default keeps Edward's full character.
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: {
          // Lower stability = more emotional range, which is what makes the
          // fillers and trailing-off read as human rather than recited.
          stability: 0.3,
          similarity_boost: 0.75,
          style: 0.45,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("ElevenLabs tts failed:", res.status, detail);
      return json({ error: "tts_unavailable" }, 502);
    }

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
