import { readSecrets } from '../secrets/store.js';

// Thin Anthropic wrapper. v1 talks JSON over HTTPS directly so we don't pull in the
// @anthropic-ai/sdk dependency for Phase 4 — the dump-zone extractor is the only consumer
// right now, and the surface area we need is small. When more features land (reconcile,
// chat, retro), promoting this to the SDK is a one-file swap.
//
// T-D31: outbound HTTPS originates here in the backend, never the browser.

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicCallInput {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
}

export interface AnthropicCallResult {
  text: string;
  input_tokens: number;
  output_tokens: number;
  stop_reason: string | null;
}

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super('Anthropic API key is not configured');
  }
}

export class AnthropicCallError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface AnthropicClient {
  available(): boolean;
  call(input: AnthropicCallInput): Promise<AnthropicCallResult>;
}

interface CreateClientOptions {
  secretsPath: string;
  fetchImpl?: typeof fetch;
}

export function createAnthropicClient({ secretsPath, fetchImpl }: CreateClientOptions): AnthropicClient {
  const doFetch = fetchImpl ?? fetch;
  return {
    available() {
      const s = readSecrets(secretsPath);
      return typeof s.anthropic_api_key === 'string' && s.anthropic_api_key.length > 0;
    },
    async call(input) {
      const s = readSecrets(secretsPath);
      const key = s.anthropic_api_key;
      if (!key) throw new AnthropicNotConfiguredError();
      const res = await doFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': key,
        },
        body: JSON.stringify({
          model: input.model,
          system: input.system,
          messages: input.messages,
          max_tokens: input.max_tokens,
          temperature: input.temperature ?? 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AnthropicCallError(`Anthropic API ${res.status}: ${body.slice(0, 200)}`, res.status);
      }
      const json = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string | null;
      };
      const text = json.content
        .filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text!)
        .join('');
      return {
        text,
        input_tokens: json.usage.input_tokens,
        output_tokens: json.usage.output_tokens,
        stop_reason: json.stop_reason,
      };
    },
  };
}
