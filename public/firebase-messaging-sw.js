/* Firebase Messaging service worker. Firebase configuration is fetched from
 * the server so NEXT_PUBLIC_* values remain the single source of truth. */
importScripts(
  'https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js'
)

const firebaseReady = fetch('/api/firebase-config')
  .then((response) => {
    if (!response.ok) throw new Error(`Firebase config request failed: ${response.status}`)
    return response.json()
  })
  .then((config) => {
    firebase.initializeApp(config)
    return firebase.messaging()
  })

firebaseReady
  .then((messaging) => {
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? payload.data?.title ?? 'New Notification'
      const body = payload.notification?.body ?? payload.data?.body ?? ''
      const url = payload.data?.url ?? '/'

      return self.registration.showNotification(title, {
        body,
        icon: payload.notification?.icon ?? '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: { url },
      })
    })
  })
  .catch((error) => {
    console.error('[Firebase SW] Initialization failed:', error)
  })

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin))
      if (existing && 'focus' in existing) {
        existing.postMessage({ type: 'NOTIFICATION_CLICKED', url })
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
