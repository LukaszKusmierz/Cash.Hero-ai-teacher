export type AuthUser = {
  id: string;
  username: string;
  display_name: string;
  role: "USER" | "TEACHER" | "ADMIN";
};

const LEGACY_AUTH_STORAGE_KEY = "cashhero_auth_session";

export function clearLegacyAuthStorage(): void {
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}
