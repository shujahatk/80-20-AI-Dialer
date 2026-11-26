/**
 * RM AI DIALER — RETELL WEBHOOK SERVICE
 * Handles signature verification, idempotent event ingestion, and CRM state synchronization.
 * Extracts native Retell post-call analysis and updates qualification results and lead statuses.
 */

import { getServerEnv } from '@/lib/env';
import { RetellClient } from './RetellClient';
import { RetellMapper } from './retell-mapper';
import { retellEventToNormalizedType } from './retell-events';
import type { RetellWebhookEvent, RetellMetadata } from './types';
import { CallsRepository } from '@/repositories/calls.repository';
import { LeadsRepository } from '@/repositories/leads.repository';
import { CampaignsRepository, unpackCampaignInstructions } from '@/repositories/campaigns.repository';
import { evaluateCampaignPostCallQualification } from '@/services/campaigns/campaign-qualification.service';
import { scheduleFollowUp } from '@/services/email/run-follow-up';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, LeadStatusDb } from '@/lib/supabase/types';

export interface WebhookProcessingResult {
  success: boolean;
  isDuplicate?: boolean;
  eventType?: string;
  callId?: string | null;
  message?: string;
  error?: string;
}

export class RetellWebhookService {
  private callsRepo: CallsRepository;
  private leadsRepo: LeadsRepository;
  private campaignsRepo: CampaignsRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.callsRepo = new CallsRepository(supabase);
    this.leadsRepo = new LeadsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
  }

  /**
   * Verifies the cryptographic signature of incoming Retell webhooks (x-retell-signature using RETELL_API_KEY).
   * Prefers Retell's official Node SDK Retell.verify() implementation with timestamp and replay protection.
   */
  async verifySignature(rawBody: string, signatureHeader?: string | null): Promise<boolean> {
    let secret = '';
    let apiKey = '';
    let isLive = false;
    try {
      const env = getServerEnv();
      secret = env.RETELL_WEBHOOK_SECRET || '';
      apiKey = env.RETELL_API_KEY || '';
      isLive = env.RM_PROVIDER_MODE === 'live';
    } catch {
      return false;
    }

    if (!signatureHeader) return false;

    // In dev/test without real webhook secret configured, allow mock-signature
    if (!isLive && signatureHeader === 'mock-signature') return true;

    // Check with RETELL_API_KEY first (Retell signs webhooks with Webhook-badged API key)
    if (apiKey) {
      const valid = await RetellClient.verifyWebhookSignature(rawBody, apiKey, signatureHeader);
      if (valid) return true;
    }

    // Check with RETELL_WEBHOOK_SECRET if configured and different
    if (secret && secret !== apiKey) {
      const valid = await RetellClient.verifyWebhookSignature(rawBody, secret, signatureHeader);
      if (valid) return true;
    }

    return false;
  }

  /**
   * Ingests and processes a Retell webhook event with strict idempotency and correlation
   */
  async processWebhook(
    payload: RetellWebhookEvent,
    rawBody?: string,
    signatureHeader?: string | null
  ): Promise<WebhookProcessingResult> {
    if (!payload || !payload.event || !payload.call) {
      return {
        success: false,
        error: 'Malformed webhook payload: missing event or call object.',
      };
    }

    // 1. Signature Verification (if raw body and signature header are provided)
    if (rawBody && signatureHeader !== undefined) {
      const isValid = await this.verifySignature(rawBody, signatureHeader);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid webhook signature.',
        };
      }
    }

    const { event, call } = payload;
    const retellCallId = call.call_id;
    const metadata = (call.metadata || {}) as Partial<RetellMetadata>;

    // 2. Generate a deterministic external event ID for idempotency
    const externalEventId = `retell_${event}_${retellCallId}_${call.end_timestamp || call.start_timestamp || Date.now()}`;

    // 3. Idempotent Ingestion Check
    const { isDuplicate, event: webhookRecord } = await this.callsRepo.recordWebhookEvent({
      source: 'retell',
      external_id: externalEventId,
      event_type: event,
      payload: payload as unknown as Json,
      organization_id: metadata.organizationId || null,
      received_at: new Date().toISOString(),
    });

    if (isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        eventType: event,
        callId: metadata.rmCallId || null,
        message: 'Event already processed (idempotency hit).',
      };
    }

    try {
      // 4. Correlate Retell Call to RM Call record
      let rmCall = metadata.rmCallId
        ? await this.callsRepo.getById(metadata.rmCallId, metadata.organizationId || undefined)
        : null;

      if (!rmCall) {
        rmCall = await this.callsRepo.getByProviderCallId(retellCallId);
      }

      if (!rmCall) {
        rmCall = await this.callsRepo.getByRetellCallId(retellCallId);
      }

      const organizationId = rmCall?.organization_id || metadata.organizationId;
      if (organizationId) {
        await this.callsRepo.assignWebhookOrganization(webhookRecord.id, organizationId);
      }
      let callId = rmCall?.id || metadata.rmCallId;

      // If call record does not exist yet and organizationId is known, initialize call record
      // Outbound calls require explicit human approval; never manufacture approved_at if operator is unattributed.
      if (!rmCall && organizationId) {
        const approvedAt = metadata.operatorId
          ? (call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString())
          : null;

        rmCall = await this.callsRepo.create({
          id: metadata.rmCallId || undefined,
          organization_id: organizationId,
          campaign_id: metadata.campaignId || null,
          lead_id: metadata.leadId || null,
          agent_id: metadata.agentId || null,
          created_by: (metadata.operatorId as string) || null,
          provider: 'live',
          retell_call_id: retellCallId,
          direction: 'outbound',
          status: 'registered',
          approved_at: approvedAt,
          started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
        });
        callId = rmCall.id;
      }

      // 5. Handle Specific Retell Webhook Events
      switch (event) {
        case 'call_started': {
          if (callId && organizationId) {
            await this.callsRepo.update(callId, organizationId, {
              status: 'in_progress',
              retell_call_id: retellCallId,
              started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
            });

            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: retellEventToNormalizedType('call_started'),
              provider_event_id: externalEventId,
              payload: {
                retell_call_id: retellCallId,
                agent_id: call.agent_id,
                status: 'in_progress',
              },
            });
          }
          break;
        }

        case 'call_ended': {
          if (callId && organizationId) {
            const mappedFields = RetellMapper.mapRetellCallToRMCallFields(call);
            const durationSec = call.duration_ms ? Math.round(call.duration_ms / 1000) : (mappedFields.duration_seconds ?? null);

            await this.callsRepo.update(callId, organizationId, {
              status: mappedFields.status,
              ended_at: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : new Date().toISOString(),
              duration_seconds: durationSec,
              disconnection_reason: call.disconnection_reason || null,
            });

            // If recording URL is available, save recording entry matching remote schema
            if (call.recording_url) {
              await this.callsRepo.saveRecording({
                organization_id: organizationId,
                call_session_id: callId,
                storage_path: call.recording_url,
                external_url: call.recording_url,
              });
            }

            // Ingest transcript utterances if available in call_ended payload
            if (call.transcript_object && call.transcript_object.length > 0) {
              const transcripts = RetellMapper.mapRetellTranscriptToRM(call.transcript_object, callId);
              for (const t of transcripts) {
                await this.callsRepo.saveTranscriptSegment({
                  organization_id: organizationId,
                  call_session_id: callId,
                  body: `${t.speaker}: ${t.text}`,
                });
              }
            } else if (call.transcript) {
              await this.callsRepo.saveTranscriptSegment({
                organization_id: organizationId,
                call_session_id: callId,
                body: call.transcript,
              });
            }

            // Log normalized RM call event
            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: retellEventToNormalizedType('call_ended', call.disconnection_reason),
              provider_event_id: externalEventId,
              payload: {
                disconnection_reason: call.disconnection_reason,
                duration_ms: call.duration_ms,
                cost: call.call_cost?.combined_cost,
              },
            });

            // Sync campaign lead progress if part of an outbound campaign
            if (metadata.campaignLeadId && metadata.campaignId) {
              const reason = (call.disconnection_reason || '').toLowerCase();
              const isVoicemail = reason.includes('voicemail') || reason.includes('machine');
              const isNoAnswer = reason.includes('no_answer') || reason.includes('busy');

              if (isVoicemail || isNoAnswer) {
                const nextAttempt = new Date(Date.now() + 3600000 * 2).toISOString();
                await this.campaignsRepo.updateAttempt(metadata.campaignLeadId, isVoicemail ? 'voicemail' : 'no_answer', nextAttempt);
              } else {
                await this.campaignsRepo.completeLead(metadata.campaignLeadId, 'completed');
              }
            }
          }
          break;
        }

        case 'call_analyzed': {
          if (callId && organizationId) {
            const analysis = RetellMapper.mapRetellAnalysisToRM(call.call_analysis);

            // Load campaign configuration & criteria if campaign is associated
            let campaignCriteria = null;
            let campaignRow = null;
            const effectiveCampaignId = metadata.campaignId || (call as any).campaign_id || null;
            if (effectiveCampaignId) {
              try {
                campaignRow = await this.campaignsRepo.getById(effectiveCampaignId, organizationId);
                if (campaignRow) {
                  const unpacked = unpackCampaignInstructions(campaignRow.email_instructions);
                  campaignCriteria = unpacked.qualificationCriteria || null;
                }
              } catch (campErr) {
                console.warn('[RetellWebhookService] Campaign lookup failed for qualification:', campErr);
              }
            }

            // Run deterministic qualification evaluation against campaign criteria
            const qualificationEval = evaluateCampaignPostCallQualification(
              {
                callOutcome: analysis.callOutcome,
                leadStatus: analysis.leadStatus,
                summary: analysis.summary,
                sentiment: analysis.sentiment,
                dncRequested: analysis.dncRequested,
                inVoicemail: analysis.inVoicemail,
                disconnectionReason: call.disconnection_reason,
                decisionMakerIdentified: analysis.decisionMakerIdentified,
                contactName: analysis.contactName,
                jobTitle: analysis.jobTitle,
                emailAddress: analysis.emailAddress,
                directPhoneNumber: analysis.directPhoneNumber,
                interestLevel: analysis.interestLevel,
                materialContext: analysis.materialContext,
                customData: analysis.qualificationData,
              },
              campaignCriteria
            );

            // Persist call outcome entry to verified call_outcomes table
            await this.callsRepo.recordOutcome({
              call_session_id: callId,
              organization_id: organizationId,
              disposition: qualificationEval.outcome,
              notes: qualificationEval.summary || analysis.summary || '',
            });

            // Log post-call analysis event with complete qualification extraction
            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: retellEventToNormalizedType('call_analyzed'),
              provider_event_id: externalEventId,
              payload: {
                summary: analysis.summary,
                call_outcome: qualificationEval.outcome,
                sentiment: analysis.sentiment,
                sentiment_score: analysis.sentimentScore,
                is_successful: analysis.isSuccessful,
                in_voicemail: analysis.inVoicemail,
                qualification: {
                  outcome: qualificationEval.outcome,
                  isQualified: qualificationEval.isQualified,
                  decisionMakerInvolved: qualificationEval.decisionMakerInvolved,
                  materialInterest: qualificationEval.materialInterest,
                  estimatedVolume: qualificationEval.estimatedVolume,
                  purchaseIntent: qualificationEval.purchaseIntent,
                  commercialRequirements: qualificationEval.commercialRequirements,
                  disqualificationReasons: qualificationEval.disqualificationReasons,
                  evidence: qualificationEval.evidence,
                  contactName: analysis.contactName,
                  jobTitle: analysis.jobTitle,
                  emailAddress: analysis.emailAddress,
                  directPhoneNumber: analysis.directPhoneNumber,
                  customData: analysis.qualificationData,
                },
              } as unknown as Json,
            });

            // Persist qualification results directly to lead record
            if (metadata.leadId) {
              const leadUpdate: Record<string, any> = {
                status: qualificationEval.recommendedDbStatus,
                notes: `[Call ${qualificationEval.outcome}] ${qualificationEval.summary}`,
              };

              if (analysis.contactName) {
                leadUpdate.name = analysis.contactName;
              }
              if (analysis.jobTitle) {
                leadUpdate.title = analysis.jobTitle;
              }
              if (analysis.emailAddress) {
                leadUpdate.email = analysis.emailAddress;
              }
              if (analysis.directPhoneNumber) {
                leadUpdate.phone = analysis.directPhoneNumber;
              }

              if (qualificationEval.outcome === 'DO_NOT_CALL') {
                await this.leadsRepo.markDnc(metadata.leadId, organizationId, 'Prospect requested DNC during AI call');
              } else {
                await this.leadsRepo.update(metadata.leadId, organizationId, leadUpdate);
              }

              // Update campaign enrollment state & outcome
              if (effectiveCampaignId) {
                try {
                  const enrollmentOutcome = qualificationEval.outcome.toLowerCase();
                  const enrollmentState =
                    qualificationEval.outcome === 'CALLBACK_REQUESTED' || qualificationEval.outcome === 'NO_ANSWER'
                      ? 'pending'
                      : 'completed';

                  await this.supabase
                    .from('campaign_enrollments')
                    .update({
                      outcome: enrollmentOutcome,
                      state: enrollmentState,
                      last_call_id: callId,
                      updated_at: new Date().toISOString(),
                    } as any)
                    .eq('campaign_id', effectiveCampaignId)
                    .eq('lead_id', metadata.leadId);
                } catch (enrollErr) {
                  console.warn('[RetellWebhookService] Failed to update campaign enrollment:', enrollErr);
                }

                // If lead is fully QUALIFIED in a campaign, trigger Resend follow-up email automation
                if (qualificationEval.isQualified && campaignRow?.email_followup_enabled) {
                  try {
                    void scheduleFollowUp(callId, 'analyzed').catch((err) => {
                      console.error('[RetellWebhookService] Error scheduling follow-up email:', err);
                    });
                  } catch (followUpErr) {
                    console.error('[RetellWebhookService] scheduleFollowUp invocation failed:', followUpErr);
                  }
                }
              }
            }
          }
          break;
        }

        case 'transcript_updated': {
          if (callId && organizationId) {
            await this.callsRepo.update(callId, organizationId, {
              transcript_status: 'streaming',
            });

            if (call.transcript_object && call.transcript_object.length > 0) {
              const transcripts = RetellMapper.mapRetellTranscriptToRM(call.transcript_object, callId);
              for (const t of transcripts) {
                await this.callsRepo.saveTranscriptSegment({
                  organization_id: organizationId,
                  call_session_id: callId,
                  call_id: callId,
                  speaker: t.speaker,
                  sequence_number: t.sequenceNumber,
                  text: t.text,
                  body: `${t.speaker}: ${t.text}`,
                  started_at_ms: t.startedAtMs,
                  ended_at_ms: t.endedAtMs,
                  confidence: t.confidence,
                  metadata: (t.metadata || {}) as Json,
                });
              }
            } else if (call.transcript) {
              await this.callsRepo.saveTranscriptSegment({
                organization_id: organizationId,
                call_session_id: callId,
                call_id: callId,
                body: call.transcript,
                text: call.transcript,
                speaker: 'system',
                sequence_number: 0,
              });
            }

            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: 'transcript_updated',
              provider_event_id: externalEventId,
              payload: {
                retell_call_id: retellCallId,
                turns_count: call.transcript_object?.length || 0,
              },
            });
          }
          break;
        }

        case 'call_failure':
        case 'call_failed': {
          if (callId && organizationId) {
            await this.callsRepo.update(callId, organizationId, {
              status: 'failed',
              disconnection_reason: call.disconnection_reason || 'Call failed at provider',
              ended_at: new Date().toISOString(),
            });

            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: 'call_failed',
              provider_event_id: externalEventId,
              payload: {
                error: call.disconnection_reason || 'Call failed',
                provider: 'retell',
              },
            });

            if (metadata.campaignLeadId) {
              const nextAttempt = new Date(Date.now() + 3600000).toISOString();
              await this.campaignsRepo.updateAttempt(metadata.campaignLeadId, 'failed', nextAttempt);
            }
          }
          break;
        }

        default: {
          // Log unknown or other valid Retell events safely without failing
          if (callId && organizationId) {
            await this.callsRepo.logEvent({
              organization_id: organizationId,
              call_id: callId,
              event_type: `retell_${event}`,
              provider_event_id: externalEventId,
              payload: { raw_event: event },
            });
          }
          break;
        }
      }

      // 6. Mark webhook event as processed
      await this.callsRepo.updateWebhookEventStatus(webhookRecord.id, 'processed');

      return {
        success: true,
        eventType: event,
        callId: callId || null,
        message: `Retell event '${event}' processed successfully.`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Webhook processing failure';
      await this.callsRepo.updateWebhookEventStatus(webhookRecord.id, 'failed', errorMsg);

      return {
        success: false,
        eventType: event,
        error: errorMsg,
      };
    }
  }
}
