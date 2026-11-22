export * from './leads.service';

export interface CsvImportPayload {
  fileName: string;
  fileSizeBytes: number;
  rowCount: number;
  mappings: Record<string, string>;
  dedupStrategy: 'skip' | 'overwrite' | 'secondary';
  targetCampaignId: string;
}
