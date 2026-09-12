import { useEffect, useState } from 'react'
import { isMuted, setMuted } from '../../lib/sfx'
import { useCavenStore } from '../../lib/store'
import { addressOf, checkAddress } from '../../../shared/address'
import { supabase } from '../../lib/supabase'
import { disablePush, enablePush, pushState, type PushState } from '../../lib/push'

/** What the notifications row says about itself, in each state it can be in. */
const PUSH_COPY: Record<PushState, string> = {
  on: 'Armed. Reminders will reach you with CAVEN closed.',
  off: 'Off. Reminders only announce themselves while CAVEN is open.',
  denied: 'Your browser has blocked notifications for this site. That has to be undone in its settings.',
  unsupported: 'This browser has no support for notifications.',
  'needs-home-screen': 'On an iPhone, add CAVEN to your Home Screen — Safari allows notifications only there.',
}

export function SettingsPage() {
  const [muted, setMutedState] = useState<boolean>(() => isMuted())
  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [push, setPush] = useState<PushState>('off')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushNote, setPushNote] = useState('')

  useEffect(() => {
    let live = true
    void pushState().then(state => { if (live) setPush(state) })
    return () => { live = false }
  }, [])

  const togglePush = async () => {
    setPushBusy(true)
    setPushNote('')
    const result = push === 'on' ? await disablePush() : await enablePush()
    // Never claim it is armed on the strength of having asked. Read it back.
    setPush(await pushState())
    if (!result.ok && result.reason) setPushNote(result.reason)
    setPushBusy(false)
  }

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

  const { data, update } = useCavenStore()
  const saved = addressOf(data)
  const [term, setTerm] = useState(saved)
  const [addressNote, setAddressNote] = useState('')

  // The store is the truth: if a voice command changes it, the field follows.
  useEffect(() => { setTerm(saved); }, [saved])

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault()
    // Same validator the voice verb uses, so the two can never disagree.
    const verdict = checkAddress(term, saved)
    if (!verdict.ok) { setAddressNote(verdict.reason); return }
    if (verdict.term === saved) { setAddressNote(`Already ${saved}.`); return }
    setAddressNote('')
    await update({ address: verdict.term })
    setAddressNote(`CAVEN will call you ${verdict.term}.`)
  }

  return (
    <div className="grid w-full max-w-md gap-4">
      <section className="glass-panel holo-board holo-in">
        <div className="holo-frame-top" />
        <div className="relative z-10">
          <p className="hud-label text-cyan-300/80">FORM OF ADDRESS</p>
          <form className="mt-3 flex items-center gap-2" onSubmit={saveAddress}>
            <input
              value={term}
              onChange={(e) => { setTerm(e.target.value); setAddressNote('') }}
              maxLength={24}
              aria-label="What CAVEN should call you"
              placeholder="sir"
              className="h-9 min-w-0 flex-1 rounded-full border border-cyan-200/20 bg-black/25 px-3 t-body text-white/90 outline-none placeholder:text-white/25 focus:border-cyan-200/50"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-100/5 px-4 py-2 t-caption tracking-[0.2em] text-cyan-100"
            >
              SAVE
            </button>
          </form>
          <div className="mt-2 t-caption opacity-60">
            {addressNote || `Sir, madam, Master \u2014 whatever suits. He can also be told out loud.`}
          </div>
        </div>
      </section>

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

      {/* Reminders had no way of reaching anyone: the tables were there, nothing
          delivered. This arms the browser; api/push-dispatch does the sending. */}
      <section className="glass-panel holo-board holo-in">
        <div className="holo-frame-top" />
        <div className="holo-frame-bottom" />
        <div className="holo-scanlines" />
        <div className="relative z-10">
          <p className="hud-label text-cyan-300/80">REMINDERS</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-white/90">Notifications on this device</div>
              <div className="text-xs opacity-60">{PUSH_COPY[push]}</div>
            </div>
            <button
              type="button"
              onClick={() => void togglePush()}
              role="switch"
              aria-checked={push === 'on'}
              disabled={pushBusy || push === 'denied' || push === 'unsupported' || push === 'needs-home-screen'}
              className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-100/5 px-4 py-2 text-xs tracking-[0.2em] text-cyan-100 disabled:opacity-40"
            >
              {pushBusy ? 'WORKING' : push === 'on' ? 'STAND DOWN' : 'ARM'}
            </button>
          </div>
          {pushNote && (
            <p className="mt-3 text-xs text-white/70" role="status">
              {pushNote}
            </p>
          )}
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
