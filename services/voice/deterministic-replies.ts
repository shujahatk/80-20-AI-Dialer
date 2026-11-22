/**
 * Phase 6 Deterministic Test Dialogue Engine
 * Used strictly for verifying STT -> ElevenLabs TTS -> Phone Audio loop before Claude integration
 */

export interface DeterministicReply {
  text: string;
  intent: string;
  suggestedState?: 'listening' | 'completed';
}

export function generateDeterministicReply(
  prospectUtterance: string,
  context?: {
    leadName?: string;
    companyName?: string;
    agentName?: string;
  }
): DeterministicReply {
  const lower = prospectUtterance.toLowerCase().trim();
  const leadName = context?.leadName || 'there';
  const companyName = context?.companyName || 'your business';
  const agentName = context?.agentName || 'Rachel';

  // 1. Initial Greeting / "Hello" / "Who is this?"
  if (
    lower.includes('hello') ||
    lower.includes('hi') ||
    lower.includes('who is this') ||
    lower.includes('speaking') ||
    lower === ''
  ) {
    return {
      text: `Hi ${leadName}, this is ${agentName} calling with RM AI. I was reaching out regarding operations at ${companyName}. How are you today?`,
      intent: 'greeting',
    };
  }

  // 2. Can you hear me / test phrases
  if (lower.includes('hear me') || lower.includes('can you hear') || lower.includes('testing')) {
    return {
      text: `Yes, I can hear you crystal clear! I received your audio: "${prospectUtterance}".`,
      intent: 'audio_check',
    };
  }

  // 3. Not interested / busy / objection
  if (lower.includes('not interested') || lower.includes('busy') || lower.includes('stop calling')) {
    return {
      text: `Understood, thanks for letting me know. I'll make a note of that and follow up by email instead. Have a great day!`,
      intent: 'objection_handled',
      suggestedState: 'completed',
    };
  }

  // 4. Questions about service
  if (lower.includes('what is this') || lower.includes('tell me more') || lower.includes('pricing')) {
    return {
      text: `We provide automated AI calling infrastructure for high-velocity sales and logistics teams. Would you be open to a quick 10-minute demo this week?`,
      intent: 'pitch',
    };
  }

  // 5. Default echo confirmation response
  return {
    text: `Thanks for sharing that. I heard you say: "${prospectUtterance}". Everything is streaming smoothly.`,
    intent: 'echo_confirmation',
  };
}
