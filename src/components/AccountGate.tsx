import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path d="m3 3 18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.8M6.2 6.8C3.7 8.5 2.5 12 2.5 12s3.5 6 9.5 6c.9 0 1.8-.2 2.6-.4" /></svg>
  );
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // A failed/slow session check used to leave the spinner up forever. Now it
  // resolves into a real, recoverable state with something to click.
  const [gateError, setGateError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setGateError('');
    // Belt and braces: a hard timeout as well as a catch, because a hanging
    // fetch never rejects on its own and that is exactly what stranded people.
    const timer = window.setTimeout(() => {
      if (!live) return;
      setGateError("Couldn't reach the sign-in service. Check your connection.");
      setLoading(false);
    }, 12000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) throw error;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setGateError("Couldn't reach the sign-in service. Check your connection.");
        setLoading(false);
      })
      .finally(() => window.clearTimeout(timer));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { live = false; window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [attempt]);

  if (loading) return <div className="auth-loading"><span className="auth-mark">C</span><span>Loading</span></div>;
  if (gateError) {
    return (
      <div className="auth-loading">
        <span className="auth-mark">C</span>
        <span>{gateError}</span>
        <button type="button" className="auth-submit" style={{ maxWidth: 220 }} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (session) return <div key={session.user.id} className="size-full">{children}</div>;

  return (
    <main className="auth-shell">
      <div className="auth-stars auth-stars-one" /><div className="auth-stars auth-stars-two" />
      <AuthPanel />
    </main>
  );
}

type Mode = 'signin' | 'signup' | 'reset';

// The typing surface lives in its own component so each keystroke only
// reconciles the form, never the session listener or the animated starfield.
function AuthPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  const signup = mode === 'signup';
  const reset = mode === 'reset';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setOk(false);
    try {
      if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? location.origin,
        });
        if (error) throw error;
        // Deliberately not confirming whether the address exists — same reply
        // either way, so this can't be used to probe for registered emails.
        setOk(true);
        setMessage('If that address has an account, a reset link is on its way.');
        return;
      }
      if (signup && password !== confirm) {
        setMessage("Those passwords don't match.");
        return;
      }
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup) {
        // Hand them to the next step rather than leaving them on a filled-in
        // signup form wondering what to do: switch to sign-in, clear secrets.
        setMode('signin');
        setPassword('');
        setConfirm('');
        setShowPassword(false);
        setOk(true);
        setMessage('Account created. Confirm your email, then sign in here.');
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message.toLowerCase() : '';
      if (raw.includes('confirm')) setMessage('Please confirm your email before signing in.');
      else if (raw.includes('already') || raw.includes('registered')) setMessage('That email already has an account — try signing in instead.');
      else if (raw.includes('password') || raw.includes('credential') || raw.includes('user')) setMessage('Invalid email or password.');
      else if (raw.includes('rate') && signup)
        setMessage("Sign-ups are temporarily unavailable — this site's confirmation-email quota is spent. Do try again later.");
      else if (raw.includes('rate')) setMessage('Too many attempts. Please try again shortly.');
      else setMessage('Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  // Switching mode always drops the secrets. Carrying a typed password from a
  // failed sign-in across to the signup form was silent and surprising.
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setMessage('');
    setOk(false);
    setPassword('');
    setConfirm('');
    setShowPassword(false);
  };

  const heading = reset ? 'Reset password' : signup ? 'Create account' : 'Sign in';

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-header">
          <img className="auth-icon" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ihy4CDV5qSbccIzEPhuVPOH6kdjCxy.png" alt="" />
          <img className="auth-wordmark" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-lfCMMGnKCnOIDetSbTUMiC2ZSafAi1.png" alt="CAVEN" />
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={`auth-tab${mode === 'signin' ? ' is-active' : ''}`} onClick={() => switchMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={signup} className={`auth-tab${signup ? ' is-active' : ''}`} onClick={() => switchMode('signup')}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit} aria-labelledby="auth-title">
          <h1 id="auth-title" className="sr-only">{heading}</h1>
          <label className="auth-label" htmlFor="auth-email">Email address</label>
          <input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input" placeholder="you@example.com" />
          {!reset && (
            <>
              <label className="auth-label" htmlFor="auth-password">
                Password{signup && <span className="auth-hint"> — at least 8 characters</span>}
              </label>
              <div className="auth-password-wrap"><input id="auth-password" required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" placeholder="••••••••" /><button type="button" className="auth-eye" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon visible={showPassword} /></button></div>
            </>
          )}
          {signup && (
            <>
              <label className="auth-label" htmlFor="auth-confirm">Confirm password</label>
              <input id="auth-confirm" required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="auth-input" placeholder="••••••••" />
            </>
          )}
          {message && <p className={`auth-message${ok ? ' is-ok' : ''}`} role="status">{message}</p>}
          <button disabled={busy} className="auth-submit" type="submit">{busy ? 'Working…' : reset ? 'Send reset link' : heading}</button>
          <p className="auth-switch">
            {reset ? (
              <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
            ) : signup ? null : (
              <button type="button" onClick={() => switchMode('reset')}>Forgot your password?</button>
            )}
          </p>
        </form>
    </section>
  );
}
