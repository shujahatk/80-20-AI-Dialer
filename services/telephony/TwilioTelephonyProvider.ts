import twilio from 'twilio';
import { getServerEnv } from '@/lib/env';
import type { TelephonyProvider, TwilioTokenResponse } from './types';

export class TwilioTelephonyProvider implements TelephonyProvider {
  private get accountSid(): string {
    try {
      return getServerEnv().TWILIO_ACCOUNT_SID || 'AC_mock_account_sid_0000000000000000';
    } catch {
      return 'AC_mock_account_sid_0000000000000000';
    }
  }

  private get authToken(): string {
    try {
      return getServerEnv().TWILIO_AUTH_TOKEN || 'mock_auth_token_0000000000000000';
    } catch {
      return 'mock_auth_token_0000000000000000';
    }
  }

  private get apiKey(): string {
    try {
      return getServerEnv().TWILIO_API_KEY || 'SK_mock_api_key_0000000000000000';
    } catch {
      return 'SK_mock_api_key_0000000000000000';
    }
  }

  private get apiSecret(): string {
    try {
      return getServerEnv().TWILIO_API_SECRET || 'mock_api_secret_0000000000000000';
    } catch {
      return 'mock_api_secret_0000000000000000';
    }
  }

  private get twimlAppSid(): string {
    try {
      return getServerEnv().TWILIO_TWIML_APP_SID || 'AP_mock_twiml_app_sid_00000000000';
    } catch {
      return 'AP_mock_twiml_app_sid_00000000000';
    }
  }

  private get defaultPhoneNumber(): string {
    try {
      return getServerEnv().TWILIO_PHONE_NUMBER || '+18005550199';
    } catch {
      return '+18005550199';
    }
  }

  private get publicUrl(): string {
    try {
      return getServerEnv().PUBLIC_URL || 'http://localhost:3000';
    } catch {
      return 'http://localhost:3000';
    }
  }

  constructor() {
    // Lazy property access prevents eager environment validation crashes during next build page-collection
  }

  /**
   * Generates a Twilio Voice Access Token for browser client WebRTC connection
   */
  async generateAccessToken(userId: string, orgId: string): Promise<TwilioTokenResponse> {
    const isLive = getServerEnv().RM_PROVIDER_MODE === 'live';
    if (isLive) {
      if (
        !this.accountSid ||
        this.accountSid.includes('mock') ||
        !this.apiKey ||
        this.apiKey.includes('mock') ||
        !this.apiSecret ||
        this.apiSecret.includes('mock') ||
        !this.twimlAppSid ||
        this.twimlAppSid.includes('mock')
      ) {
        throw new Error(
          '[Twilio Live Mode Error] Live Twilio credentials (Account SID, API Key, API Secret, TwiML App SID) are missing or set to mock placeholders.'
        );
      }
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = `user_${userId}_org_${orgId}`;
    const token = new AccessToken(
      this.accountSid,
      this.apiKey,
      this.apiSecret,
      {
        identity,
        ttl: 3600, // 1 hour token
      }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    return {
      token: token.toJwt(),
      identity,
      expiresInSeconds: 3600,
      twimlAppSid: this.twimlAppSid,
    };
  }

  /**
   * Generates TwiML XML instructing Twilio to dial the destination phone number
   */
  generateOutboundTwiml(params: {
    destinationNumber: string;
    callerId?: string;
    callId: string;
    leadId: string;
    campaignId?: string | null;
    recordCall?: boolean;
  }): string {
    const response = new twilio.twiml.VoiceResponse();
    const callerId = params.callerId || this.defaultPhoneNumber;
    const statusCallbackUrl = `${this.publicUrl}/api/webhooks/twilio/call-status?callId=${encodeURIComponent(params.callId)}&leadId=${encodeURIComponent(params.leadId)}${params.campaignId ? `&campaignId=${encodeURIComponent(params.campaignId)}` : ''}`;
    const recordingCallbackUrl = `${this.publicUrl}/api/webhooks/twilio/recording?callId=${encodeURIComponent(params.callId)}`;

    const dialOptions: Record<string, string | number | boolean | undefined> = {
      callerId,
      answerOnBridge: true,
      timeLimit: 3600,
    };

    if (params.recordCall) {
      dialOptions.record = 'record-from-answer-dual';
      dialOptions.recordingStatusCallback = recordingCallbackUrl;
      dialOptions.recordingStatusCallbackEvent = 'completed';
    }

    const dial = response.dial(dialOptions);
    dial.number(
      {
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      },
      params.destinationNumber
    );

    return response.toString();
  }

  /**
   * Generates TwiML rejecting a call (e.g. DNC or blocked)
   */
  generateRejectionTwiml(reason: string = 'The number cannot be dialed.'): string {
    const response = new twilio.twiml.VoiceResponse();
    response.say({ voice: 'Polly.Joanna-Neural' }, reason);
    response.hangup();
    return response.toString();
  }

  /**
   * Validates Twilio Webhook Signature for request integrity
   */
  validateWebhookSignature(url: string, params: Record<string, string>, signature: string): boolean {
    // In local dev/mock test mode when using placeholder secrets, allow bypass if signature is 'mock-signature'
    if (this.authToken === 'mock_auth_token_0000000000000000' && signature === 'mock-signature') {
      return true;
    }

    try {
      return twilio.validateRequest(this.authToken, signature, url, params);
    } catch {
      return false;
    }
  }

  /**
   * Programmatically hangs up / terminates an active call in Twilio
   */
  async terminateCall(callSid: string): Promise<boolean> {
    if (this.accountSid.startsWith('AC_mock')) {
      return true;
    }

    try {
      const client = twilio(this.accountSid, this.authToken);
      await client.calls(callSid).update({ status: 'completed' });
      return true;
    } catch (err) {
      console.error('[TwilioTelephonyProvider] Failed to terminate call:', err);
      return false;
    }
  }
}

export const twilioProvider = new TwilioTelephonyProvider();
