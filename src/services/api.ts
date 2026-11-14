const TOKEN_KEY = 'smartcity_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string, remember = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response' };
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
