/**
 * RM AI DIALER — RETELL CALL SERVICE
 * Handles individual AI call dispatching, status retrieval, and call correlation.
 */

import { RetellProvider, retellProvider } from './RetellProvider';
import type {
  RetellMetadata,
  RetellCallResponse,
  NormalizedCallStartResult,
} from './types';
import { normalizeRetellCallStatus } from './retell-events';

export interface StartRetellCallParams {
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  agentVersion?: number;
  metadata: RetellMetadata;
  dynamicVariables?: Record<string, string | number | boolean>;
}

export class RetellCallService {
  private provider: RetellProvider;

  constructor(provider: RetellProvider = retellProvider) {
    this.provider = provider;
  }

  /**
   * Dispatches an outbound call through Retell with attached correlation metadata.
   */
  async startOutboundCall(params: StartRetellCallParams): Promise<NormalizedCallStartResult> {
    const { fromNumber, toNumber, agentId, agentVersion, metadata, dynamicVariables } = params;

    if (!toNumber) {
      throw new Error('[RetellCallService] Destination phone number (toNumber) is required.');
    }

    if (!fromNumber) {
      throw new Error('[RetellCallService] Originating phone number (fromNumber) is required.');
    }

    if (!metadata.organizationId || !metadata.leadId) {
      throw new Error('[RetellCallService] Metadata must include organizationId and leadId for correlation.');
    }

    // Prepare safe correlation metadata (never include sensitive tokens)
    const sanitizedMetadata: RetellMetadata = {
      organizationId: metadata.organizationId,
      leadId: metadata.leadId,
      campaignId: metadata.campaignId || null,
      campaignLeadId: metadata.campaignLeadId || null,
      agentId: metadata.agentId || null,
      agentVersionId: metadata.agentVersionId || null,
      rmCallId: metadata.rmCallId || null,
    };

    return this.provider.startOutboundCall({
      from_number: fromNumber,
      to_number: toNumber,
      override_agent_id: agentId,
      override_agent_version: agentVersion,
      metadata: sanitizedMetadata,
      retell_llm_dynamic_variables: dynamicVariables,
    });
  }

  /**
   * Retrieves runtime call details from Retell
   */
  async getCall(callId: string): Promise<RetellCallResponse> {
    return this.provider.getCall(callId);
  }

  /**
   * Helper to map raw Retell call state
   */
  mapCallStatus(call: RetellCallResponse) {
    return normalizeRetellCallStatus(call.call_status, call.disconnection_reason);
  }
}

export const retellCallService = new RetellCallService();
