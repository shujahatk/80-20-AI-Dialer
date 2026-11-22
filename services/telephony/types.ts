export type CallState =
  | 'idle'
  | 'preparing'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'ending'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'failed'
  | 'cancelled';

export type CallEventType =
  | 'call_created'
  | 'preparing'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'mute'
  | 'unmute'
  | 'dtmf'
  | 'ending'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'failed'
  | 'cancelled'
  | 'recording_ready'
  | 'transcript_ready';

export interface InitiateCallParams {
  leadId: string;
  destinationNumber: string;
  campaignId?: string | null;
  aiAgentId?: string | null;
  operatorId?: string | null;
  callerId?: string;
  recordCall?: boolean;
}

export interface TwilioTokenResponse {
  token: string;
  identity: string;
  expiresInSeconds: number;
  twimlAppSid: string;
  /** False when Twilio credentials are placeholders — do not register a browser Device. */
  registerDevice?: boolean;
}

export interface TwilioStatusCallbackPayload {
  CallSid: string;
  AccountSid?: string;
  From?: string;
  To?: string;
  CallStatus: string;
  ApiVersion?: string;
  Direction?: string;
  ForwardedFrom?: string;
  CallerName?: string;
  Duration?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingDuration?: string;
  SequenceNumber?: string;
  Timestamp?: string;
  [key: string]: string | undefined;
}

export interface TwilioRecordingCallbackPayload {
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: string;
  RecordingDuration: string;
  RecordingChannels: string;
  RecordingStartTime: string;
  CallSid: string;
  AccountSid?: string;
  [key: string]: string | undefined;
}

export interface TelephonyProvider {
  generateAccessToken(userId: string, orgId: string): Promise<TwilioTokenResponse>;
  generateOutboundTwiml(params: {
    destinationNumber: string;
    callerId: string;
    callId: string;
    leadId: string;
    campaignId?: string | null;
    recordCall?: boolean;
  }): string;
  validateWebhookSignature(url: string, params: Record<string, string>, signature: string): boolean;
}
