import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp
let messaging: Messaging | null = null

function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]!
  }
  return app
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (messaging) return messaging

  try {
    const firebaseApp = getFirebaseApp()


    messaging = getMessaging(firebaseApp)
    return messaging
  } catch (error) {
    console.error('[Firebase] Failed to initialize messaging:', error)
    return null
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) {
    console.warn('[Firebase] Notifications not supported')
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('[Firebase] Notification permission denied')
    return null
  }

  const messaging = getFirebaseMessaging()
  if (!messaging) return null

  try {
    const { getToken } = await import('firebase/messaging')
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    })
    return token
  } catch (error) {
    console.error('[Firebase] Failed to get token:', error)
    return null
  }
}

export async function onForegroundMessage(
  callback: (payload: { title?: string; body?: string; icon?: string; data?: Record<string, unknown> }) => void
): Promise<() => void> {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}

  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
      icon: payload.notification?.icon,
      data: payload.data as Record<string, unknown> | undefined,
    })
  })
}
