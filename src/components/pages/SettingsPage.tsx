import { useEffect, useState } from 'react'
import { isMuted, setMuted } from '../../lib/sfx'
import { supabase } from '../../lib/supabase'

export function SettingsPage() {
  const [muted, setMutedState] = useState<boolean>(() => isMuted())
  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let live = true
    supabase.auth.getSession().then(({ data }) => {
      if (live) setEmail(data.session?.user.email ?? null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setEmail(session?.user.email ?? null)
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const signOut = async () => {
    setSigningOut(true)
    setNotice('')
    const { error } = await supabase.auth.signOut()
    if (error) {
      setNotice('I could not sign you out just then. Do try once more.')
      setSigningOut(false)
    }
    // On success the auth listener in AccountGate takes over and shows the
    // sign-in panel, so there is nothing further to do here.
  }

  return (
    <div className="grid w-full max-w-md gap-4">
      <section className="glass-panel holo-board holo-in">
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />
        <div className="holo-scanlines" />
        <div className="relative z-10">
          <p className="hud-label text-cyan-300/80">SOUND</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-white/90">Interface sound effects</div>
              <div className="text-xs opacity-60">{muted ? 'Muted.' : 'Audible, and kept quiet.'}</div>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              role="switch"
              aria-checked={!muted}
              className="rounded-full border border-cyan-200/20 bg-cyan-100/5 px-4 py-2 text-xs tracking-[0.2em] text-cyan-100"
            >
              {muted ? 'UNMUTE' : 'MUTE'}
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel holo-board holo-in">
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />
        <div className="holo-scanlines" />
        <div className="relative z-10">
          <p className="hud-label text-cyan-300/80">ACCOUNT</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm text-white/90">{email ?? 'Not signed in.'}</div>
              <div className="text-xs opacity-60">Your board is private to this account.</div>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut || !email}
              className="rounded-full border border-cyan-200/20 bg-cyan-100/5 px-4 py-2 text-xs tracking-[0.2em] text-cyan-100 disabled:opacity-40"
            >
              {signingOut ? 'SIGNING OUT' : 'SIGN OUT'}
            </button>
          </div>
          {notice && (
            <p className="mt-3 text-xs text-white/70" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>

      <section className="glass-panel holo-board holo-in">
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />
        <div className="holo-scanlines" />
        <div className="relative z-10">
          <p className="hud-label text-cyan-300/80">VOICE</p>
          <div className="mt-3 text-sm text-white/90">Edward, an English valet voice</div>
          <div className="mt-1 text-xs opacity-60">
            Speech is synthesised by ElevenLabs on the server. The voice and its credentials are
            configured there and are never sent to this browser. Should speech be unavailable, the
            browser's own voice stands in.
          </div>
        </div>
      </section>
    </div>
  )
}
