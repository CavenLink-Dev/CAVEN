// Print a fresh VAPID key pair for push notifications.
//
//   pnpm vapid
//
// Put the two values in Vercel as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, and
// set VAPID_SUBJECT to a mailto: address the push services can complain to.
// Rotating them invalidates every existing browser subscription — everyone has
// to arm notifications again in Settings — so do it only when a key has leaked.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log(`
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:cavenlink.dev@gmail.com

The public key is safe in a browser; the private key never leaves the server.
Add all three in Vercel (Production), then redeploy before arming a device.
`)
