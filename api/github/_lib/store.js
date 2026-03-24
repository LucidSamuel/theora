import { SESSION_KEY_PREFIX, isProduction } from './config.js';

const memoryStore = globalThis.__theoraGitHubSessionStore || new Map();
if (!globalThis.__theoraGitHubSessionStore) {
  globalThis.__theoraGitHubSessionStore = memoryStore;
}

function getStoreMode() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  if (!isProduction()) {
    return 'memory';
  }
  return 'unavailable';
}

export function isSessionStoreAvailable() {
  return getStoreMode() !== 'unavailable';
}

function keyForSession(sessionId) {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

async function upstashRequest(commandPath) {
  const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/${commandPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Session store request failed (${response.status})`);
  }
  return response.json();
}

export async function saveSessionValue(sessionId, sealedValue, ttlSeconds) {
  const safeTtl = Math.max(1, Math.floor(Number(ttlSeconds)));
  const key = keyForSession(sessionId);
  const mode = getStoreMode();
  if (mode === 'memory') {
    memoryStore.set(key, {
      value: sealedValue,
      expiresAt: Date.now() + safeTtl * 1000,
    });
    return;
  }
  if (mode === 'upstash') {
    await upstashRequest(`setex/${encodeURIComponent(key)}/${safeTtl}/${encodeURIComponent(sealedValue)}`);
    return;
  }
  throw new Error('GitHub session store is not configured');
}

export async function getSessionValue(sessionId) {
  const key = keyForSession(sessionId);
  const mode = getStoreMode();
  if (mode === 'memory') {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }
  if (mode === 'upstash') {
    const data = await upstashRequest(`get/${encodeURIComponent(key)}`);
    return typeof data.result === 'string' ? data.result : null;
  }
  throw new Error('GitHub session store is not configured');
}

export async function deleteSessionValue(sessionId) {
  const key = keyForSession(sessionId);
  const mode = getStoreMode();
  if (mode === 'memory') {
    memoryStore.delete(key);
    return;
  }
  if (mode === 'upstash') {
    await upstashRequest(`del/${encodeURIComponent(key)}`);
    return;
  }
  throw new Error('GitHub session store is not configured');
}
