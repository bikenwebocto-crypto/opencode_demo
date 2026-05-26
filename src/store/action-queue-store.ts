import { create } from 'zustand';
import type { ActionQueueItemWithRef, ActionQueueStatus } from '@/types';

interface ActionQueueState {
  items: ActionQueueItemWithRef[];
  pendingCount: number;
  inProgressCount: number;
  selectedItem: ActionQueueItemWithRef | null;
  isProcessing: boolean;

  setItems: (items: ActionQueueItemWithRef[]) => void;
  addItem: (item: ActionQueueItemWithRef) => void;
  updateItemStatus: (id: string, status: ActionQueueStatus) => void;
  removeItem: (id: string) => void;
  setSelectedItem: (item: ActionQueueItemWithRef | null) => void;
  setProcessing: (processing: boolean) => void;
  recalculateCounts: () => void;
  prependItem: (item: ActionQueueItemWithRef) => void;
}

export const useActionQueueStore = create<ActionQueueState>()((set, get) => ({
  items: [],
  pendingCount: 0,
  inProgressCount: 0,
  selectedItem: null,
  isProcessing: false,

  setItems: (items) => {
    set({ items });
    get().recalculateCounts();
  },

  addItem: (item) => {
    set((state) => ({ items: [item, ...state.items] }));
    get().recalculateCounts();
  },

  prependItem: (item) => {
    set((state) => {
      const exists = state.items.some((i) => i.id === item.id);
      if (exists) return state;
      return { items: [item, ...state.items] };
    });
    get().recalculateCounts();
  },

  updateItemStatus: (id, status) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
    }));
    get().recalculateCounts();
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
    get().recalculateCounts();
  },

  setSelectedItem: (item) => set({ selectedItem: item }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  recalculateCounts: () => {
    const { items } = get();
    set({
      pendingCount: items.filter((i) => i.status === 'PENDING').length,
      inProgressCount: items.filter((i) => i.status === 'IN_PROGRESS').length,
    });
  },
}));
