import { useCore } from "../../lib/coreState"
const copy = {
  idle: "Tap to speak",
  listening: "Listening… take your time",
  thinking: "Considering the evidence…",
  speaking: "CAVEN is responding",
  success: "Done. Nicely handled.",
}
export function VoiceBar() {
  const { state, advance } = useCore()
  return (
    <button
      onClick={advance}
      className="voice-bar"
      aria-label="Activate Caven voice assistant"
    >
      <span className="waveform">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${i * 75}ms` }} />
        ))}
      </span>
      <span className="voice-copy">
        <b>{copy[state]}</b>
        <small>
          {state === "idle"
            ? "or hold the core to gather a thought"
            : "tap again to continue the demonstration"}
        </small>
      </span>
      <span className="mic-button">⌁</span>
    </button>
  )
}
