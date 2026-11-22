/**
 * RM AI DIALER — RETELL DOMAIN MAPPER
 * Centralizes all conversions between Retell API models and RM CRM / Database records.
 */

import type {
  RetellCallResponse,
  RetellTranscriptUtterance,
  RetellCallAnalysis,
  RetellDisconnectionReason,
  NormalizedTranscriptEntry,
  NormalizedPostCallAnalysis,
} from './types';
import { normalizeRetellCallStatus, mapDisconnectionToCallStatus } from './retell-events';

export class RetellMapper {
  /**
   * Maps Retell Call object to partial RM Call record fields for updates
   */
  static mapRetellCallToRMCallFields(retellCall: RetellCallResponse) {
    const status = normalizeRetellCallStatus(retellCall.call_status, retellCall.disconnection_reason);
    const durationSeconds = retellCall.duration_ms ? Math.round(retellCall.duration_ms / 1000) : 0;

    let startedAt: string | undefined;
    if (retellCall.start_timestamp) {
      startedAt = new Date(retellCall.start_timestamp).toISOString();
    }

    let endedAt: string | undefined;
    if (retellCall.end_timestamp) {
      endedAt = new Date(retellCall.end_timestamp).toISOString();
    }

    return {
      provider: 'retell' as const,
      provider_call_id: retellCall.call_id,
      retell_call_id: retellCall.call_id,
      provider_agent_id: retellCall.agent_id || null,
      status,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      connected_seconds: status === 'completed' || status === 'in_progress' ? durationSeconds : 0,
      disconnection_reason: retellCall.disconnection_reason || null,
      call_cost: retellCall.call_cost?.combined_cost ?? 0,
      recording_status: retellCall.recording_url ? 'ready' : 'none',
      transcript_status: retellCall.transcript ? 'completed' : 'pending',
      provider_metadata: (retellCall.metadata as Record<string, unknown>) || {},
    };
  }

  /**
   * Converts Retell transcript utterances to normalized RM call transcript rows
   */
  static mapRetellTranscriptToRM(
    utterances: RetellTranscriptUtterance[],
    callId: string
  ): NormalizedTranscriptEntry[] {
    if (!Array.isArray(utterances)) return [];

    return utterances.map((u, index) => {
      let speaker: 'ai' | 'lead' | 'operator' | 'system' = 'lead';
      if (u.role === 'agent') speaker = 'ai';
      else if (u.role === 'user') speaker = 'lead';
      else if (u.role === 'system') speaker = 'system';

      let startedAtMs = 0;
      let endedAtMs = 0;

      if (u.words && u.words.length > 0) {
        startedAtMs = Math.round(u.words[0].start * 1000);
        endedAtMs = Math.round(u.words[u.words.length - 1].end * 1000);
      }

      return {
        speaker,
        sequenceNumber: index + 1,
        text: u.content.trim(),
        startedAtMs,
        endedAtMs,
        confidence: 1.0,
        metadata: {
          wordCount: u.words?.length || 0,
          callId,
        },
      };
    });
  }

  /**
   * Normalizes Retell post-call analysis into RM CRM fields
   */
  static mapRetellAnalysisToRM(analysis?: RetellCallAnalysis): NormalizedPostCallAnalysis {
    if (!analysis) {
      return {
        summary: 'No AI analysis generated for this call.',
        sentiment: 'neutral',
        sentimentScore: 0.5,
        isSuccessful: false,
        inVoicemail: false,
        qualificationData: {},
      };
    }

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let sentimentScore = 0.5;

    const rawSent = (analysis.user_sentiment || '').toLowerCase();
    if (rawSent.includes('pos')) {
      sentiment = 'positive';
      sentimentScore = 0.9;
    } else if (rawSent.includes('neg')) {
      sentiment = 'negative';
      sentimentScore = 0.1;
    } else {
      sentiment = 'neutral';
      sentimentScore = 0.5;
    }

    const isSuccessful = Boolean(analysis.call_successful);
    const inVoicemail = Boolean(analysis.in_voicemail);
    const customData = analysis.custom_analysis_data || {};
    const dncRequested = Boolean(
      customData.dnc_requested ||
      customData.dnc ||
      analysis.call_summary?.toLowerCase().includes('do not call') ||
      analysis.call_summary?.toLowerCase().includes('dnc')
    );
    const callbackRequested = Boolean(
      customData.callback_requested ||
      customData.callback ||
      analysis.call_summary?.toLowerCase().includes('call back') ||
      analysis.call_summary?.toLowerCase().includes('callback')
    );

    // Section 7: Retell Native Lead Qualification Extraction
    const summaryLower = (analysis.call_summary || '').toLowerCase();

    // 1. Decision-maker identified
    const decisionMakerIdentified = Boolean(
      customData.decision_maker_identified === true ||
      customData.is_decision_maker === true ||
      customData.decision_maker === 'yes' ||
      summaryLower.includes('decision-maker') ||
      summaryLower.includes('decision maker')
    );

    // 2. Contact details
    const contactName = (customData.contact_name || customData.decision_maker_name || null) as string | null;
    const jobTitle = (customData.job_title || customData.title || null) as string | null;
    const emailAddress = (customData.email_address || customData.email || null) as string | null;
    const directPhoneNumber = (customData.direct_phone_number || customData.direct_phone || customData.phone || null) as string | null;

    // 3. Interest level
    let interestLevel = 'none';
    if (customData.interest_level) {
      interestLevel = String(customData.interest_level).toLowerCase();
    } else if (isSuccessful) {
      interestLevel = 'high';
    } else if (sentiment === 'positive') {
      interestLevel = 'medium';
    } else if (sentiment === 'negative') {
      interestLevel = 'low';
    }

    // 4. Context & follow-up requirements
    const materialContext = (customData.material_context || customData.business_context || customData.context || analysis.call_summary || null) as string | null;
    const followUpRequirements = (customData.follow_up_requirements || customData.next_steps || customData.followup || null) as string | null;
    const callOutcome = (customData.call_outcome || customData.outcome || analysis.call_summary || 'Call finished') as string;

    // 5. Seven Authorized Lead Statuses
    let leadStatus: 'Confirmed' | 'Interested' | 'Follow-up' | 'Callback' | 'Not Interested' | 'Do Not Call' | 'Unqualified' = 'Unqualified';

    if (dncRequested) {
      leadStatus = 'Do Not Call';
    } else if (
      // "A Confirmed lead must have a decision-maker who confirms interest and provides contact details."
      decisionMakerIdentified &&
      (interestLevel === 'high' || interestLevel === 'confirmed' || isSuccessful) &&
      (Boolean(emailAddress) || Boolean(directPhoneNumber)) &&
      Boolean(contactName)
    ) {
      leadStatus = 'Confirmed';
    } else if (
      interestLevel === 'high' ||
      interestLevel === 'medium' ||
      interestLevel === 'interested' ||
      isSuccessful ||
      sentiment === 'positive'
    ) {
      leadStatus = 'Interested';
    } else if (callbackRequested) {
      leadStatus = 'Callback';
    } else if (Boolean(followUpRequirements) || summaryLower.includes('follow up') || summaryLower.includes('follow-up') || summaryLower.includes('send info')) {
      leadStatus = 'Follow-up';
    } else if (sentiment === 'negative' || summaryLower.includes('not interested') || summaryLower.includes('declined')) {
      leadStatus = 'Not Interested';
    } else {
      leadStatus = 'Unqualified';
    }

    return {
      summary: analysis.call_summary || 'Call finished.',
      sentiment,
      sentimentScore,
      isSuccessful,
      inVoicemail,
      qualificationData: customData,
      dncRequested,
      callbackRequested,
      decisionMakerIdentified,
      contactName,
      jobTitle,
      emailAddress,
      directPhoneNumber,
      interestLevel,
      materialContext,
      followUpRequirements,
      callOutcome,
      leadStatus,
      rawAnalysis: analysis,
    };
  }

  /**
   * Maps Retell disconnection reason to RM CRM disposition code and campaign retry recommendation
   */
  static mapDisconnectionToDisposition(reason?: RetellDisconnectionReason): {
    code: string;
    category: 'positive' | 'neutral' | 'negative' | 'administrative';
    shouldRetry: boolean;
    retryDelayMinutes: number;
    triggersDnc: boolean;
  } {
    if (!reason) {
      return {
        code: 'COMPLETED_STANDARD',
        category: 'neutral',
        shouldRetry: false,
        retryDelayMinutes: 0,
        triggersDnc: false,
      };
    }

    const norm = reason.toLowerCase();

    if (norm === 'user_hangup' || norm === 'agent_hangup') {
      return {
        code: 'COMPLETED_CONVERSATION',
        category: 'positive',
        shouldRetry: false,
        retryDelayMinutes: 0,
        triggersDnc: false,
      };
    }

    if (norm === 'call_transfer') {
      return {
        code: 'HUMAN_TRANSFER',
        category: 'positive',
        shouldRetry: false,
        retryDelayMinutes: 0,
        triggersDnc: false,
      };
    }

    if (norm === 'voicemail_reached' || norm === 'machine_detected') {
      return {
        code: 'VOICEMAIL_LEFT',
        category: 'neutral',
        shouldRetry: true,
        retryDelayMinutes: 120,
        triggersDnc: false,
      };
    }

    if (norm === 'no_answer' || norm === 'dial_no_answer') {
      return {
        code: 'NO_ANSWER',
        category: 'neutral',
        shouldRetry: true,
        retryDelayMinutes: 60,
        triggersDnc: false,
      };
    }

    if (norm === 'busy' || norm === 'dial_busy') {
      return {
        code: 'LINE_BUSY',
        category: 'neutral',
        shouldRetry: true,
        retryDelayMinutes: 15,
        triggersDnc: false,
      };
    }

    if (norm === 'concurrency_limit_reached') {
      return {
        code: 'CONCURRENCY_EXCEEDED',
        category: 'administrative',
        shouldRetry: true,
        retryDelayMinutes: 5,
        triggersDnc: false,
      };
    }

    if (norm === 'inactivity') {
      return {
        code: 'CALL_INACTIVITY',
        category: 'neutral',
        shouldRetry: true,
        retryDelayMinutes: 60,
        triggersDnc: false,
      };
    }

    return {
      code: 'FAILED_CALL',
      category: 'negative',
      shouldRetry: true,
      retryDelayMinutes: 30,
      triggersDnc: false,
    };
  }
}
