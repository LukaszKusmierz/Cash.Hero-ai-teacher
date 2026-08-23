export type AuthUser = {
  id: string;
  username: string;
  display_name: string;
  token?: string | null;
};

const AUTH_STORAGE_KEY = "cashhero_auth_session";

export function getStoredAuth(): AuthUser | null {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY);
    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeAuth(user: AuthUser | null): void {
  if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return getStoredAuth()?.token ?? null;
}

