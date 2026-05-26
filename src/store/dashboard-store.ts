import { create } from 'zustand';
import type { DashboardFilter, AnalyticsSummary, RedemptionChartData, TopMerchantData, ActionQueueStatus, ActionQueueType } from '@/types';

interface DashboardState {
  // Filters
  filters: DashboardFilter;
  setFilters: (filters: Partial<DashboardFilter>) => void;
  resetFilters: () => void;

  // Analytics
  summary: AnalyticsSummary | null;
  chartData: RedemptionChartData[];
  topMerchants: TopMerchantData[];
  setSummary: (summary: AnalyticsSummary) => void;
  setChartData: (data: RedemptionChartData[]) => void;
  setTopMerchants: (merchants: TopMerchantData[]) => void;

  // Action Queue Filters
  queueFilters: {
    status: ActionQueueStatus | 'ALL';
    type: ActionQueueType | 'ALL';
    search: string;
    page: number;
  };
  setQueueFilters: (filters: Partial<DashboardState['queueFilters']>) => void;
  resetQueueFilters: () => void;

  // Loading states
  isSummaryLoading: boolean;
  isChartLoading: boolean;
  setSummaryLoading: (loading: boolean) => void;
  setChartLoading: (loading: boolean) => void;
}

const defaultFilters: DashboardFilter = {
  dateRange: {},
  search: '',
};

const defaultQueueFilters = {
  status: 'ALL' as const,
  type: 'ALL' as const,
  search: '',
  page: 1,
};

export const useDashboardStore = create<DashboardState>()((set) => ({
  filters: { ...defaultFilters },
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  summary: null,
  chartData: [],
  topMerchants: [],
  setSummary: (summary) => set({ summary }),
  setChartData: (chartData) => set({ chartData }),
  setTopMerchants: (topMerchants) => set({ topMerchants }),

  queueFilters: { ...defaultQueueFilters },
  setQueueFilters: (filters) =>
    set((state) => ({ queueFilters: { ...state.queueFilters, ...filters } })),
  resetQueueFilters: () => set({ queueFilters: { ...defaultQueueFilters } }),

  isSummaryLoading: false,
  isChartLoading: false,
  setSummaryLoading: (isSummaryLoading) => set({ isSummaryLoading }),
  setChartLoading: (isChartLoading) => set({ isChartLoading }),
}));
