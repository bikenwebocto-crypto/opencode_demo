import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

let app: App | undefined
let messaging: Messaging | undefined

function getFirebaseAdminApp(): App {
  if (app) return app

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not configured')
  }

  app = getApps()[0] ?? initializeApp({
    projectId,
    credential: cert({ projectId, clientEmail, privateKey }),
  })

  return app
}

export function getFirebaseAdminMessaging(): Messaging {
  if (!messaging) {
    messaging = getMessaging(getFirebaseAdminApp())
  }
  return messaging
}
