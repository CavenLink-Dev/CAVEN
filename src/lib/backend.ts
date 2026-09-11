import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SUPABASE_FN = `https://${projectId}.supabase.co/functions/v1/make-server-3159d1b2`;

function apiUrl(path: string) {
  // Same-origin /api on Vercel. Figma/Vite preview proxies /api to the edge function.
  if (typeof window !== 'undefined') return `/api/${path}`;
  return `${SUPABASE_FN}/${path}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${publicAnonKey}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), { ...init, headers });
}
