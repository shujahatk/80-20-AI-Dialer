import type {
  ConversationContext,
  StructuredTurnResponse,
  CallSummaryResult,
  LLMUsageStats,
} from './types';

export interface ILLMProvider {
  readonly providerName: string;

  /**
   * Generates a validated structured conversation turn response
   */
  generateTurnResponse(
    context: ConversationContext,
    latestUtterance: string,
    abortSignal?: AbortSignal
  ): Promise<{ response: StructuredTurnResponse; stats: LLMUsageStats }>;

  /**
   * Generates structured post-call summary and qualification notes
   */
  generateCallSummary(
    context: ConversationContext
  ): Promise<CallSummaryResult>;

  /**
   * Health status of LLM provider
   */
  getHealth(): Promise<{ status: 'connected' | 'degraded' | 'disconnected' | 'testing'; model: string }>;
}
