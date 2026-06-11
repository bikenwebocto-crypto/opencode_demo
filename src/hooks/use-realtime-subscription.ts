'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRealtimeStore } from '@/store/realtime-store';
import { useActionQueueStore } from '@/store/action-queue-store';
import { useNotificationStore } from '@/store/notification-store';
import { subscribeToChannel, type RealtimePayload } from '@/lib/realtime/client';
import type {
  RedemptionRealtimeEvent,
  ActionQueueRealtimeEvent,
  MerchantStatusRealtimeEvent,
  OfferStatusRealtimeEvent,
} from '@/types';

interface UseRealtimeSubscriptionOptions {
  userId?: string;
  userType?: string;
  merchantId?: string;
  companyId?: string;
  enabled?: boolean;
}

/**
 * Hook that manages all realtime subscriptions for the current user
 * Automatically subscribes/unsubscribes based on user type
 */
export function useRealtimeSubscriptions(options: UseRealtimeSubscriptionOptions) {
  const { userId, userType, merchantId, companyId, enabled = true } = options;

  const addRedemption = useRealtimeStore((s) => s.addRedemption);
  const addActionQueue = useRealtimeStore((s) => s.addActionQueue);
  const addMerchantStatus = useRealtimeStore((s) => s.addMerchantStatus);
  const addOfferStatus = useRealtimeStore((s) => s.addOfferStatus);
  const setConnected = useRealtimeStore((s) => s.setConnected);
  const setConnectionQuality = useRealtimeStore((s) => s.setConnectionQuality);

  const prependActionQueueItem = useActionQueueStore((s) => s.prependItem);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const redemptionsRef = useRef(addRedemption);
  redemptionsRef.current = addRedemption;

  // Subscribe to Postgres changes via Supabase Realtime
  useEffect(() => {
    if (!enabled) return;

    const unsubscribers: (() => void)[] = [];

    // Admin subscriptions
    if (userType === 'admin') {
      const h1 = subscribeToChannel(
        'admin-action-queue',
        { table: 'action_queue_items', event: '*' },
        (payload: RealtimePayload) => {
          if (payload.eventType === 'INSERT') {
            prependActionQueueItem(payload.new as any);
          }
        },
        (status: string) => {
          setConnected(status === 'SUBSCRIBED');
          setConnectionQuality(status === 'SUBSCRIBED' ? 'good' : 'degraded');
        }
      );
      unsubscribers.push(h1.unsubscribe);

      const h2 = subscribeToChannel(
        'admin-redemptions',
        { table: 'redemptions', event: 'INSERT' },
        (payload: RealtimePayload) => {
          redemptionsRef.current(payload.new as RedemptionRealtimeEvent);
        }
      );
      unsubscribers.push(h2.unsubscribe);
    }

    // Merchant subscriptions
    if (userType === 'merchant' && merchantId) {
      const h1 = subscribeToChannel(
        `merchant-${merchantId}-redemptions`,
        { table: 'redemptions', event: 'INSERT', filter: `merchant_id=eq.${merchantId}` },
        (payload: RealtimePayload) => {
          redemptionsRef.current(payload.new as RedemptionRealtimeEvent);
        }
      );
      unsubscribers.push(h1.unsubscribe);

      const h2 = subscribeToChannel(
        `merchant-${merchantId}-status`,
        { table: 'merchants', event: 'UPDATE', filter: `id=eq.${merchantId}` },
        (payload: RealtimePayload) => {
          addMerchantStatus(payload.new as MerchantStatusRealtimeEvent);
        }
      );
      unsubscribers.push(h2.unsubscribe);
    }

    // Employee subscriptions
    if (userType === 'employee') {
      const h1 = subscribeToChannel(
        `employee-${userId}-notifications`,
        { table: 'notification_events', event: 'INSERT', filter: `recipient_id=eq.${userId}` },
        (payload: RealtimePayload) => {
          addNotification(payload.new as any);
        }
      );
      unsubscribers.push(h1.unsubscribe);
    }

    // Company admin subscriptions
    if (userType === 'company_admin' && companyId) {
      const h1 = subscribeToChannel(
        `company-${companyId}-notifications`,
        { table: 'notification_events', event: 'INSERT', filter: `recipient_id=eq.${userId}` },
        (payload: RealtimePayload) => {
          addNotification(payload.new as any);
        }
      );
      unsubscribers.push(h1.unsubscribe);
    }

    // Offer status changes (all authenticated users)
    const hGlobal = subscribeToChannel(
      'global-offer-status',
      { table: 'merchant_offers', event: 'UPDATE' },
      (payload: RealtimePayload) => {
        addOfferStatus(payload.new as OfferStatusRealtimeEvent);
      }
    );
    unsubscribers.push(hGlobal.unsubscribe);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, userType, merchantId, companyId, userId]);
}

/**
 * Hook for subscribing to a specific Postgres table changes
 */
export function usePostgresSubscription<T>(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*',
  filter?: string,
  enabled = true
) {
  const callbackRef = useRef<((payload: T) => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handle = subscribeToChannel(
      `custom-${table}-${Date.now()}`,
      { table, event, filter },
      (payload: RealtimePayload) => {
        callbackRef.current?.(payload.new as T);
      }
    );

    return handle.unsubscribe;
  }, [table, event, filter, enabled]);

  const onEvent = useCallback((callback: (payload: T) => void) => {
    callbackRef.current = callback;
  }, []);

  return { onEvent };
}
