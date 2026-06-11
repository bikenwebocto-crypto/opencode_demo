export type Unsubscribe = () => void

export type ChannelFilter = {
  table?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

export type RealtimePayload<T = unknown> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  commit_timestamp: string
}

export type SubscriptionHandle = {
  unsubscribe: Unsubscribe
}

export function subscribeToChannel(
  name: string,
  filter: ChannelFilter,
  onPayload: (payload: RealtimePayload) => void,
  onStatus?: (status: string) => void
): SubscriptionHandle {
  void name
  void filter
  void onPayload
  void onStatus
  return { unsubscribe: () => {} }
}
