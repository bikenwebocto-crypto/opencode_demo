import { createClient } from './client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================
// REALTIME CHANNEL CONFIGURATION
// ============================================================

export interface ChannelConfig {
  name: string;
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

export const REALTIME_CHANNELS: Record<string, ChannelConfig> = {
  actionQueue: {
    name: 'realtime:action_queue',
    table: 'action_queue_items',
    event: '*',
  },
  redemptions: {
    name: 'realtime:redemptions',
    table: 'redemptions',
    event: 'INSERT',
  },
  merchantStatus: {
    name: 'realtime:merchant_status',
    table: 'merchants',
    event: 'UPDATE',
    filter: 'status=neq.undefined',
  },
  offerStatus: {
    name: 'realtime:offer_status',
    table: 'merchant_offers',
    event: 'UPDATE',
    filter: 'status=neq.undefined',
  },
  companyStatus: {
    name: 'realtime:company_status',
    table: 'companies',
    event: 'UPDATE',
  },
  notifications: {
    name: 'realtime:notifications',
    table: 'notification_events',
    event: 'INSERT',
  },
};

// Realtime event topic naming strategy:
//   admin:*           - all admin dashboard events
//   merchant:{id}:*   - merchant-specific events
//   company:{id}:*    - company-specific events
//   employee:{id}:*   - employee-specific events
//   system:*          - system-level broadcasts

export type RealtimeTopic =
  | 'admin:dashboard'
  | 'admin:action-queue'
  | `merchant:${string}:dashboard`
  | `merchant:${string}:redemptions`
  | `merchant:${string}:offers`
  | `company:${string}:dashboard`
  | `company:${string}:employees`
  | `employee:${string}:notifications`
  | 'system:analytics';

// ============================================================
// SUBSCRIPTION MANAGER
// ============================================================

interface SubscriptionEntry {
  channel: ReturnType<ReturnType<typeof createClient>['channel']>;
  topics: Set<string>;
  callback: (payload: any) => void;
}

const subscriptions = new Map<string, SubscriptionEntry>();

/**
 * Subscribe to a Realtime channel with deduplication
 */
export function subscribeToChannel(
  channelName: string,
  config: {
    table: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    filter?: string;
  },
  onPayload: (payload: RealtimePostgresChangesPayload<any>) => void,
  onStatus?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
): () => void {
  const client = createClient();
  const key = `${channelName}:${config.table}`;

  // Deduplicate: reuse existing subscription if available
  if (subscriptions.has(key)) {
    const existing = subscriptions.get(key)!;
    existing.topics.add(channelName);

    return () => {
      existing.topics.delete(channelName);
      if (existing.topics.size === 0) {
        existing.channel.unsubscribe();
        subscriptions.delete(key);
      }
    };
  }

  const channel = client.channel(channelName);

  channel.on(
    'postgres_changes',
    {
      event: config.event ?? '*',
      schema: 'public',
      table: config.table,
      filter: config.filter,
    },
    (payload: RealtimePostgresChangesPayload<any>) => {
      onPayload(payload);
    }
  );

  channel.subscribe((status: string) => {
    onStatus?.(status as any);
  });

  subscriptions.set(key, {
    channel,
    topics: new Set([channelName]),
    callback: onPayload,
  });

  // Return unsubscribe function
  return () => {
    const entry = subscriptions.get(key);
    if (entry) {
      entry.channel.unsubscribe();
      subscriptions.delete(key);
    }
  };
}

/**
 * Broadcast an event to all clients on a channel
 */
export async function broadcastEvent(
  topic: RealtimeTopic,
  event: string,
  payload: Record<string, unknown>
) {
  const client = createClient();
  const channel = client.channel(topic);

  await channel.send({
    type: 'broadcast',
    event,
    payload: {
      ...payload,
      _meta: {
        timestamp: new Date().toISOString(),
        topic,
        event,
        idempotencyKey: `${topic}:${event}:${Date.now()}`,
      },
    },
  });
}

/**
 * Clean up all subscriptions (call on unmount)
 */
export function unsubscribeAll() {
  for (const [key, entry] of subscriptions) {
    entry.channel.unsubscribe();
    subscriptions.delete(key);
  }
}
