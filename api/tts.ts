import { EDWARD_VOICE, json } from "./_caven";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return json({ error: "tts_unavailable" }, 502);

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
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
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.78,
          style: 0.15,
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
    return json({ error: "tts_unavailable" }, 502);
  }
}
