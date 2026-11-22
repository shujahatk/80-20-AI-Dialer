import type { DashboardMetric } from '@/types';

export interface FunnelStageData {
  stageNumber: number;
  stageName: string;
  count: number;
  conversionPercent: number;
  barPercent: number;
  highlight?: boolean;
}

export interface HeatmapHourSlot {
  hour: string;
  rate: number;
  isPeak?: boolean;
}

export interface HeatmapDayData {
  day: string;
  slots: HeatmapHourSlot[];
  autoPaused?: boolean;
}

export interface IAnalyticsService {
  fetchExecutiveMetrics(): Promise<DashboardMetric[]>;
  fetchFunnelData(): Promise<FunnelStageData[]>;
  fetchHourlyHeatmap(): Promise<HeatmapDayData[]>;
}

export class AnalyticsServicePlaceholder implements IAnalyticsService {
  async fetchExecutiveMetrics(): Promise<DashboardMetric[]> {
    return [];
  }
  async fetchFunnelData(): Promise<FunnelStageData[]> {
    return [];
  }
  async fetchHourlyHeatmap(): Promise<HeatmapDayData[]> {
    return [];
  }
}

export const analyticsService = new AnalyticsServicePlaceholder();
