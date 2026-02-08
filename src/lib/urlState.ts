export function getSearchParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function getHashState(): { demo: string; state: string } | null {
  const raw = window.location.hash.replace('#', '');
  if (!raw) return null;
  const [demo, state] = raw.split('|');
  if (!demo || !state) return null;
  return { demo, state };
}

export function setSearchParams(updates: Record<string, string | null>): void {
  const params = new URLSearchParams(window.location.search);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

export function encodeState(value: unknown): string {
  const json = JSON.stringify(value);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeState<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    const json = decodeURIComponent(escape(atob(value)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function encodeStatePlain(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

export function decodeStatePlain<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return null;
  }
}
