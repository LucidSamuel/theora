import type { AiChallengeRequest, AiPrediction } from '../types';
import { ApiKeyStore } from './apiKeyStore';
import { globalRateLimiter } from './rateLimiter';
import { buildPrompt } from './promptBuilder';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

export class AiClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_KEY' | 'RATE_LIMITED' | 'INVALID_KEY' | 'API_ERROR' | 'PARSE_ERROR',
  ) {
    super(message);
    this.name = 'AiClientError';
  }
}

/**
 * Calls the Anthropic Messages API directly from the browser via CORS.
 * The key never leaves the browser except in the Authorization header to api.anthropic.com.
 */
export async function generateAiChallenge(request: AiChallengeRequest): Promise<AiPrediction> {
  const key = ApiKeyStore.get();
  if (!key) {
    throw new AiClientError('No API key configured. Add your Anthropic key in settings.', 'NO_KEY');
  }

  if (!globalRateLimiter.tryAcquire()) {
    const state = globalRateLimiter.getState();
    const waitSec = Math.ceil((state.resetAt - Date.now()) / 1000);
    throw new AiClientError(
      `Rate limited. Try again in ${waitSec}s. (${state.maxPerWindow} requests per ${state.windowMs / 1000}s window)`,
      'RATE_LIMITED',
    );
  }

  const { system, user } = buildPrompt(request);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (response.status === 401) {
    throw new AiClientError('Invalid API key. Check your key and try again.', 'INVALID_KEY');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error');
    throw new AiClientError(`API error (${response.status}): ${body}`, 'API_ERROR');
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new AiClientError('Unexpected API response format.', 'PARSE_ERROR');
  }

  return parseAiResponse(text);
}

function parseAiResponse(text: string): AiPrediction {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch?.[1]?.trim() ?? text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new AiClientError(`Failed to parse AI response as JSON: ${text.slice(0, 200)}`, 'PARSE_ERROR');
  }

  if (!isValidAiPrediction(parsed)) {
    throw new AiClientError('AI response did not match expected schema.', 'PARSE_ERROR');
  }

  return parsed;
}

function isValidAiPrediction(obj: unknown): obj is AiPrediction {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.question !== 'string' || o.question.length === 0) return false;
  if (!Array.isArray(o.choices) || o.choices.length !== 4) return false;
  for (const c of o.choices) {
    if (typeof c !== 'object' || c === null) return false;
    if (typeof (c as Record<string, unknown>).label !== 'string') return false;
    if (typeof (c as Record<string, unknown>).rationale !== 'string') return false;
  }
  if (typeof o.correctIndex !== 'number' || o.correctIndex < 0 || o.correctIndex > 3) return false;
  if (typeof o.explanation !== 'string') return false;
  return true;
}
