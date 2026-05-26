import { create } from 'zustand';
import type { RealtimePayload, RedemptionRealtimeEvent, ActionQueueRealtimeEvent, MerchantStatusRealtimeEvent, OfferStatusRealtimeEvent } from '@/types';

interface RealtimeEventBuffer<T> {
  events: T[];
  lastProcessedAt: number;
}

interface RealtimeState {
  redemptions: RealtimeEventBuffer<RedemptionRealtimeEvent>;
  actionQueue: RealtimeEventBuffer<ActionQueueRealtimeEvent>;
  merchantStatus: RealtimeEventBuffer<MerchantStatusRealtimeEvent>;
  offerStatus: RealtimeEventBuffer<OfferStatusRealtimeEvent>;

  isConnected: boolean;
  activeChannels: string[];
  connectionQuality: 'good' | 'degraded' | 'disconnected';

  addRedemption: (event: RedemptionRealtimeEvent) => void;
  addActionQueue: (event: ActionQueueRealtimeEvent) => void;
  addMerchantStatus: (event: MerchantStatusRealtimeEvent) => void;
  addOfferStatus: (event: OfferStatusRealtimeEvent) => void;

  setConnected: (connected: boolean) => void;
  addChannel: (channel: string) => void;
  removeChannel: (channel: string) => void;
  setConnectionQuality: (quality: 'good' | 'degraded' | 'disconnected') => void;

  flushEvents: () => void;
  clearBuffer: (buffer: keyof Pick<RealtimeState, 'redemptions' | 'actionQueue' | 'merchantStatus' | 'offerStatus'>) => void;
}

const BUFFER_FLUSH_MS = 1000;

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  redemptions: { events: [], lastProcessedAt: Date.now() },
  actionQueue: { events: [], lastProcessedAt: Date.now() },
  merchantStatus: { events: [], lastProcessedAt: Date.now() },
  offerStatus: { events: [], lastProcessedAt: Date.now() },

  isConnected: false,
  activeChannels: [],
  connectionQuality: 'disconnected',

  addRedemption: (event) =>
    set((state) => ({
      redemptions: {
        events: [...state.redemptions.events, event].slice(-100),
        lastProcessedAt: Date.now(),
      },
    })),

  addActionQueue: (event) =>
    set((state) => ({
      actionQueue: {
        events: [...state.actionQueue.events, event].slice(-100),
        lastProcessedAt: Date.now(),
      },
    })),

  addMerchantStatus: (event) =>
    set((state) => ({
      merchantStatus: {
        events: [...state.merchantStatus.events, event].slice(-50),
        lastProcessedAt: Date.now(),
      },
    })),

  addOfferStatus: (event) =>
    set((state) => ({
      offerStatus: {
        events: [...state.offerStatus.events, event].slice(-50),
        lastProcessedAt: Date.now(),
      },
    })),

  setConnected: (isConnected) => set({ isConnected }),
  addChannel: (channel) =>
    set((state) => ({
      activeChannels: state.activeChannels.includes(channel)
        ? state.activeChannels
        : [...state.activeChannels, channel],
    })),
  removeChannel: (channel) =>
    set((state) => ({
      activeChannels: state.activeChannels.filter((c) => c !== channel),
    })),
  setConnectionQuality: (connectionQuality) => set({ connectionQuality }),

  flushEvents: () => {
    // Batched processing hook consumers will read from store
    const now = Date.now();
    set({
      redemptions: { ...get().redemptions, lastProcessedAt: now },
      actionQueue: { ...get().actionQueue, lastProcessedAt: now },
      merchantStatus: { ...get().merchantStatus, lastProcessedAt: now },
      offerStatus: { ...get().offerStatus, lastProcessedAt: now },
    });
  },

  clearBuffer: (buffer) =>
    set({ [buffer]: { events: [], lastProcessedAt: Date.now() } }),
}));
