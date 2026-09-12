/* CAVEN service worker — reminder delivery only.
 *
 * Deliberately not a cache. This app is a live voice assistant against live
 * APIs; an offline cache here would serve a stale board and stale replies,
 * which is worse than an honest failure. The only job is to receive a push
 * while the tab is closed and to put the user back in the app when they tap it.
 */

self.addEventListener('install', () => {
  // Take over at once: a reminder that arrives during a deploy should still land.
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'CAVEN'
  const body = typeof payload.body === 'string' ? payload.body : ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // One notification per reminder, so a retried delivery replaces rather
      // than stacks. userVisibleOnly means we must always show something.
      tag: typeof payload.tag === 'string' ? payload.tag : 'caven-reminder',
      renotify: true,
      data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Reuse a tab that is already on CAVEN rather than opening a second one.
      for (const client of open) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })(),
  )
})
