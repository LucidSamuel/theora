import { isProduction } from './config.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let cachedKeyPromise = null;

function base64Encode(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(value) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(bytes) {
  return base64Encode(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return base64Decode(normalized + padding);
}

function getSessionSecret() {
  return process.env.GITHUB_SESSION_SECRET || '';
}

export function hasSessionSecret() {
  return getSessionSecret().length >= 32;
}

async function getSessionKey() {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      const secret = getSessionSecret();
      if (!secret) {
        throw new Error('GitHub session secret not configured');
      }
      const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
      return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
    })();
  }
  return cachedKeyPromise;
}

export async function sealSession(payload) {
  const key = await getSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function unsealSession(sealed) {
  try {
    const [version, ivPart, ciphertextPart] = sealed.split('.');
    if (version !== 'v1' || !ivPart || !ciphertextPart) {
      return null;
    }
    const key = await getSessionKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(ivPart) },
      key,
      base64UrlDecode(ciphertextPart),
    );
    const payload = JSON.parse(textDecoder.decode(plaintext));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
