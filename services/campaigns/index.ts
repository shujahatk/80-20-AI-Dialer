export * from './campaigns.service';
export * from './campaign-retell-dispatcher.service';
import type { Campaign, CampaignStatus } from '@/types';

export interface ICampaignsService {
  fetchCampaigns(status?: CampaignStatus): Promise<Campaign[]>;
  updateCampaignStatus(id: string, status: CampaignStatus): Promise<boolean>;
  updatePacing(id: string, multiplier: number): Promise<boolean>;
  dispatchTestCall(agentId: string, destinationNumber: string): Promise<{ success: boolean; callSid: string }>;
}
