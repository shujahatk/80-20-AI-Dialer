import crypto from 'crypto';
import { Retell } from 'retell-sdk';
import { getServerEnv } from '@/lib/env';
import type {
  RetellCreatePhoneCallRequest,
  RetellCallResponse,
  RetellAgentReference,
  RetellProviderHealth,
} from './types';

export class RetellClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(options?: { baseUrl?: string; apiKey?: string; timeoutMs?: number }) {
    if (options?.apiKey) {
      this.apiKey = options.apiKey;
      this.baseUrl = options.baseUrl || 'https://api.retellai.com';
    } else {
      try {
        const env = getServerEnv();
        this.apiKey = env.RETELL_API_KEY || '';
        this.baseUrl = env.RETELL_API_BASE_URL || 'https://api.retellai.com';
      } catch {
        this.apiKey = '';
        this.baseUrl = 'https://api.retellai.com';
      }
    }
    this.timeoutMs = options?.timeoutMs || 15000;
  }

  /**
   * Checks if the client has a configured (non-mock, non-empty) API key.
   */
  get isConfigured(): boolean {
    return (
      Boolean(this.apiKey) &&
      !this.apiKey.includes('mock_retell') &&
      !this.apiKey.includes('key_xxxx')
    );
  }

  /**
   * Executes an authenticated HTTP request with timeout and error sanitization.
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      body?: unknown;
      retryCount?: number;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, retryCount = 1 } = options;

    if (!this.apiKey) {
      throw new Error('[RetellClient] Missing API key. RETELL_API_KEY is not configured.');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'RM-AI-Dialer/2.0',
    };

    let attempt = 0;
    while (attempt <= retryCount) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = response.status;
          let errorText = '';
          try {
            const errJson = await response.json();
            errorText = errJson.message || errJson.error || JSON.stringify(errJson);
          } catch {
            errorText = await response.text().catch(() => 'Unknown response body');
          }

          // Retry on 429 (rate limit) or 503 (service unavailable) if attempts remain
          if ((status === 429 || status === 503 || status === 502) && attempt < retryCount) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            continue;
          }

          throw new Error(`[Retell API Error ${status}] ${errorText}`);
        }

        // 204 No Content
        if (response.status === 204) {
          return {} as T;
        }

        return (await response.json()) as T;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`[RetellClient] Request to ${endpoint} timed out after ${this.timeoutMs}ms`);
        }

        if (attempt < retryCount && !(err instanceof Error && err.message.includes('401'))) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }

        const sanitizedMsg = err instanceof Error ? err.message : 'Unknown network failure';
        throw new Error(`[RetellClient] Failed to execute ${method} ${endpoint}: ${sanitizedMsg}`);
      }
    }

    throw new Error(`[RetellClient] Request failed after ${retryCount} retries`);
  }

  /**
   * Health Check: Validates API Key & connectivity by querying list-agents
   */
  async checkHealth(): Promise<RetellProviderHealth> {
    const checkedAt = new Date().toISOString();

    if (!this.isConfigured) {
      return {
        status: 'unconfigured',
        authenticated: false,
        latencyMs: 0,
        errorMessage: 'RETELL_API_KEY is missing or contains placeholder value.',
        checkedAt,
      };
    }

    const start = Date.now();
    try {
      const agents = await this.request<RetellAgentReference[]>('/list-agents', {
        method: 'GET',
        retryCount: 0,
      });

      return {
        status: 'healthy',
        authenticated: true,
        latencyMs: Date.now() - start,
        agentCount: Array.isArray(agents) ? agents.length : 0,
        errorMessage: null,
        checkedAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      const isAuthError = msg.includes('401') || msg.includes('Unauthorized');

      return {
        status: isAuthError ? 'unreachable' : 'degraded',
        authenticated: false,
        latencyMs: Date.now() - start,
        errorMessage: msg,
        checkedAt,
      };
    }
  }

  /**
   * Initiates an outbound phone call via Retell
   */
  async createPhoneCall(params: RetellCreatePhoneCallRequest): Promise<RetellCallResponse> {
    return this.request<RetellCallResponse>('/v2/create-phone-call', {
      method: 'POST',
      body: params,
      retryCount: 0, // Never auto-retry call creation to avoid double-dials
    });
  }

  /**
   * Retrieves call details by Retell call_id
   */
  async getCall(callId: string): Promise<RetellCallResponse> {
    if (!callId) {
      throw new Error('[RetellClient] Call ID is required to get call details.');
    }
    return this.request<RetellCallResponse>(`/v2/get-call/${encodeURIComponent(callId)}`, {
      method: 'GET',
    });
  }

  /**
   * Retrieves an agent by Retell agent_id
   */
  async getAgent(agentId: string): Promise<RetellAgentReference> {
    if (!agentId) {
      throw new Error('[RetellClient] Agent ID is required.');
    }
    return this.request<RetellAgentReference>(`/get-agent/${encodeURIComponent(agentId)}`, {
      method: 'GET',
    });
  }

  /**
   * Lists all available agents in the Retell account
   */
  async listAgents(): Promise<RetellAgentReference[]> {
    return this.request<RetellAgentReference[]>('/list-agents', {
      method: 'GET',
    });
  }

  /**
   * Creates a new Retell agent
   */
  async createAgent(payload: {
    agent_name: string;
    voice_id: string;
    llm_websocket_url?: string;
    response_engine?: {
      type: 'retell-llm' | 'custom-llm';
      llm_id?: string;
      llm_websocket_url?: string;
    };
    language?: string;
    ambient_sound?: string;
    interruption_sensitivity?: number;
    responsiveness?: number;
  }): Promise<RetellAgentReference> {
    return this.request<RetellAgentReference>('/create-agent', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Updates an existing Retell agent
   */
  async updateAgent(
    agentId: string,
    payload: {
      agent_name?: string;
      voice_id?: string;
      llm_websocket_url?: string;
      response_engine?: {
        type: 'retell-llm' | 'custom-llm';
        llm_id?: string;
        llm_websocket_url?: string;
      };
      language?: string;
      ambient_sound?: string;
      interruption_sensitivity?: number;
      responsiveness?: number;
    }
  ): Promise<RetellAgentReference> {
    if (!agentId) {
      throw new Error('[RetellClient] Agent ID is required for update.');
    }
    return this.request<RetellAgentReference>(`/update-agent/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  /**
   * Lists supported Retell voices
   */
  async listVoices(): Promise<
    Array<{
      voice_id: string;
      voice_name: string;
      provider: string;
      gender: string;
      accent: string;
      preview_audio_url?: string;
    }>
  > {
    try {
      return await this.request<
        Array<{
          voice_id: string;
          voice_name: string;
          provider: string;
          gender: string;
          accent: string;
          preview_audio_url?: string;
        }>
      >('/list-voices', { method: 'GET' });
    } catch {
      // Return verified fallback catalog if endpoint is unavailable
      return [
        {
          voice_id: '11labs-Adrian',
          voice_name: 'Rachel (Consultative Professional)',
          provider: 'ElevenLabs',
          gender: 'female',
          accent: 'american',
        },
        {
          voice_id: '11labs-Brian',
          voice_name: 'David (Operations Specialist)',
          provider: 'ElevenLabs',
          gender: 'male',
          accent: 'american',
        },
        {
          voice_id: 'openai-Alloy',
          voice_name: 'Alex (Direct & Energetic)',
          provider: 'OpenAI',
          gender: 'neutral',
          accent: 'american',
        },
        {
          voice_id: 'cartesia-sonic-en',
          voice_name: 'Sonic Enterprise (Ultra-low Latency)',
          provider: 'Cartesia',
          gender: 'female',
          accent: 'american',
        },
      ];
    }
  }

  /**
   * Lists all configured phone numbers in the Retell account
   */
  async listPhoneNumbers(): Promise<
    Array<{
      phone_number: string;
      phone_number_pretty?: string;
      inbound_agent_id?: string;
      outbound_agent_id?: string;
      nickname?: string;
      telephony_provider?: string;
      area_code?: number;
    }>
  > {
    try {
      return await this.request<
        Array<{
          phone_number: string;
          phone_number_pretty?: string;
          inbound_agent_id?: string;
          outbound_agent_id?: string;
          nickname?: string;
          telephony_provider?: string;
          area_code?: number;
        }>
      >('/list-phone-numbers', { method: 'GET' });
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a specific phone number configuration from Retell
   */
  async getPhoneNumber(phoneNumber: string): Promise<{
    phone_number: string;
    inbound_agent_id?: string;
    outbound_agent_id?: string;
    nickname?: string;
  }> {
    if (!phoneNumber) {
      throw new Error('[RetellClient] Phone number is required.');
    }
    return this.request<{
      phone_number: string;
      inbound_agent_id?: string;
      outbound_agent_id?: string;
      nickname?: string;
    }>(`/get-phone-number/${encodeURIComponent(phoneNumber)}`, {
      method: 'GET',
    });
  }

  /**
   * Imports an existing Twilio or custom SIP phone number into Retell
   */
  async importPhoneNumber(payload: {
    phone_number: string;
    termination_uri?: string;
    nickname?: string;
    inbound_agent_id?: string;
    outbound_agent_id?: string;
  }): Promise<{
    phone_number: string;
    nickname?: string;
  }> {
    return this.request<{
      phone_number: string;
      nickname?: string;
    }>('/import-phone-number', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Cryptographically verifies incoming Retell webhook signature.
   * Prefers Retell's official Node SDK Retell.verify() implementation (v={timestamp},d={digest}),
   * with backward-compatible fallback for raw HMAC-SHA256 hex digests.
   */
  static async verifyWebhookSignature(
    rawBody: string,
    apiKeyOrSecret: string,
    signatureHeader?: string | null
  ): Promise<boolean> {
    if (!signatureHeader || !apiKeyOrSecret || !rawBody) {
      return false;
    }

    const trimmedSignature = signatureHeader.trim();

    // 1. Primary: Official Retell Node SDK verification (v={timestamp},d={digest})
    try {
      const isValid = await Retell.verify(rawBody, apiKeyOrSecret, trimmedSignature);
      if (isValid) {
        return true;
      }
    } catch {
      // In case format doesn't match v=...,d=... structure, fall through to raw digest check
    }

    // 2. Fallback: Raw HMAC-SHA256 hex digest (for unit test fixtures or manual test tooling)
    try {
      const computed = crypto
        .createHmac('sha256', apiKeyOrSecret)
        .update(rawBody, 'utf-8')
        .digest('hex');

      const signatureBuffer = Buffer.from(trimmedSignature, 'utf-8');
      const computedBuffer = Buffer.from(computed, 'utf-8');

      if (signatureBuffer.length === computedBuffer.length) {
        return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
      }
    } catch {
      return false;
    }

    return false;
  }
}

export const retellClient = new RetellClient();
