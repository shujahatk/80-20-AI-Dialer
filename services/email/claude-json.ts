import Anthropic from '@anthropic-ai/sdk';
import { getServerEnv } from '@/lib/env';
import { ClaudeUnavailableError, type ClaudeJsonClient } from './qualification';

export function createAnthropicJsonClient(): ClaudeJsonClient {
  return {
    async completeJson(system: string, user: string): Promise<string> {
      const env = getServerEnv();
      const key = env.ANTHROPIC_API_KEY;
      if (!key || key.includes('mock_anthropic') || key.includes('sk-ant-xxx')) {
        throw new ClaudeUnavailableError();
      }
      const client = new Anthropic({ apiKey: key });
      const message = await client.messages.create({
        model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 900,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = message.content.find((block) => block.type === 'text');
      if (!text || text.type !== 'text' || !text.text.trim()) throw new ClaudeUnavailableError();
      return text.text;
    },
  };
}
