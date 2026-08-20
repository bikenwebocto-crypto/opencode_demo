'use client'

import { useEffect, useCallback, useState } from 'react'
import {
  requestNotificationPermission,
  onForegroundMessage,
} from '@/lib/firebase'
import { showToast } from '@/hooks/use-toast'

interface UsePushNotificationsOptions {
  enabled?: boolean
  onTokenReceived?: (token: string) => void
  onNotification?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { enabled = true, onTokenReceived, onNotification } = options
  const [token, setToken] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'Notification' in window && 'serviceWorker' in navigator
    setIsSupported(supported)
    setPermission(Notification.permission)
  }, [])

  // Register service worker
  useEffect(() => {
    if (!enabled || !isSupported) return

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch((err) => {
        console.error('[Push] Service worker registration failed:', err)
      })
  }, [enabled, isSupported])

  // Request permission and get token
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('[Push] Permission request skipped: unsupported browser')
      return null
    }

    const fcmToken = await requestNotificationPermission()
    if (fcmToken) {
      setToken(fcmToken)
      setPermission('granted')
      await fetch('/api/device-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fcmToken, platform: 'web' }),
      }).catch((error) => {
        console.error('[Push] Token registration failed:', error)
      })
      onTokenReceived?.(fcmToken)
    } else {
      setPermission(Notification.permission)
      console.warn('[Push] No FCM token generated', {
        permission: Notification.permission,
      })
    }
    return fcmToken
  }, [isSupported, onTokenReceived])

  // Listen for foreground messages
  useEffect(() => {
    if (!enabled || !isSupported) return

    let unsubscribe: (() => void) | null = null

    onForegroundMessage((notification) => {
      onNotification?.(notification)

      showToast({
        type: 'info',
        title: notification.title ?? 'New Notification',
        description: notification.body,
      })

      if (Notification.permission === 'granted') {
        new window.Notification(
          notification.title ?? 'New Notification',
          {
            body: notification.body,
            icon: notification.icon ?? '/icon-192x192.png',
          },
        )
      }

      try {
        new window.Notification(
          notification.title ?? 'New Notification',
          {
            body: notification.body,
          },
        )
      } catch (error) {
        console.error('[Push] Notification constructor failed', error)
      }
    }).then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      unsubscribe?.()
    }
  }, [enabled, isSupported, onNotification])
  // Auto-request on mount if permission is default
  useEffect(() => {
    if (!enabled || !isSupported) return
    if (Notification.permission === 'default') {
      requestPermission()
    } else if (Notification.permission === 'granted') {
      requestPermission()
    }
  }, [enabled, isSupported, requestPermission])

  return {
    token,
    permission,
    isSupported,
    requestPermission,
  }
}
