export async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fnv1a(data: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export type HashFunction = 'sha256' | 'fnv1a';

export async function hashLeaf(data: string, mode: HashFunction): Promise<string> {
  const prefixed = '\x00' + data;
  return mode === 'sha256' ? sha256(prefixed) : fnv1a(prefixed);
}

export async function hashInternal(left: string, right: string, mode: HashFunction): Promise<string> {
  const prefixed = '\x01' + left + right;
  return mode === 'sha256' ? sha256(prefixed) : fnv1a(prefixed);
}
