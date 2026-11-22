/**
 * RM AI DIALER — RETELL PROVIDER
 * Unified high-level provider interface for Retell AI runtime.
 */

import { RetellClient, retellClient } from './RetellClient';
import type {
  RetellCreatePhoneCallRequest,
  RetellCallResponse,
  RetellAgentReference,
  RetellProviderHealth,
  NormalizedCallStartResult,
} from './types';
import { normalizeRetellCallStatus } from './retell-events';

export class RetellProvider {
  private client: RetellClient;

  constructor(client: RetellClient = retellClient) {
    this.client = client;
  }

  /**
   * Evaluates if the Retell provider is properly configured and operational.
   */
  async getReadiness(): Promise<RetellProviderHealth> {
    return this.client.checkHealth();
  }

  /**
   * Starts an outbound phone call via Retell
   */
  async startOutboundCall(
    params: RetellCreatePhoneCallRequest
  ): Promise<NormalizedCallStartResult> {
    if (!this.client.isConfigured) {
      const isLive = process.env.RM_PROVIDER_MODE === 'live' || process.env.NODE_ENV === 'production';
      if (isLive) {
        return {
          success: false,
          provider: 'retell',
          providerCallId: '',
          status: 'failed',
          error: '[RetellProvider] Retell is not configured. Missing RETELL_API_KEY in production or live mode.',
        };
      }

      const mockCallId = `retell_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        provider: 'retell',
        providerCallId: mockCallId,
        status: 'queued',
        rawResponse: {
          call_id: mockCallId,
          call_status: 'registered',
        },
      };
    }

    try {
      const response = await this.client.createPhoneCall(params);

      const status = normalizeRetellCallStatus(response.call_status, response.disconnection_reason);
      const isQueuedOrProgress = status === 'queued' || status === 'in_progress';

      return {
        success: isQueuedOrProgress,
        provider: 'retell',
        providerCallId: response.call_id,
        status: isQueuedOrProgress ? (status as 'queued' | 'in_progress') : 'failed',
        rawResponse: response,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown call initiation failure';
      return {
        success: false,
        provider: 'retell',
        providerCallId: '',
        status: 'failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Retrieves call data from Retell
   */
  async getCall(callId: string): Promise<RetellCallResponse> {
    return this.client.getCall(callId);
  }

  /**
   * Retrieves an agent from Retell
   */
  async getAgent(agentId: string): Promise<RetellAgentReference> {
    return this.client.getAgent(agentId);
  }

  /**
   * Lists agents available in Retell
   */
  async listAgents(): Promise<RetellAgentReference[]> {
    return this.client.listAgents();
  }

  /**
   * Verifies incoming webhook authenticity
   */
  verifyWebhookSignature(
    rawBody: string,
    apiKeyOrSecret: string,
    signatureHeader?: string | null
  ): boolean {
    return RetellClient.verifyWebhookSignature(rawBody, apiKeyOrSecret, signatureHeader);
  }
}

export const retellProvider = new RetellProvider();
