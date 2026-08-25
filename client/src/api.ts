import type { AuthUser } from "./auth";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
export const AUTH_EXPIRED_EVENT = "cashhero:auth-expired";
const CSRF_HEADER = "X-XSRF-TOKEN";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

type ApiErrorBody = { error?: string; details?: Record<string, string> };

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(`${API_URL}/auth/csrf`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Nie można pobrać tokenu CSRF (${response.status}).`);
        const body = await response.json() as { token?: string };
        if (!body.token) throw new Error("Backend nie zwrócił tokenu CSRF.");
        csrfToken = body.token;
        return body.token;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }
  return csrfTokenRequest;
}

function clearCsrfToken(): void {
  csrfToken = null;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (UNSAFE_METHODS.has(method)) headers.set(CSRF_HEADER, await getCsrfToken());

  let response: Response;
  const send = () => fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  try {
    response = await send();
    if (response.status === 403 && UNSAFE_METHODS.has(method)) {
      clearCsrfToken();
      headers.set(CSRF_HEADER, await getCsrfToken());
      response = await send();
    }
  } catch {
    throw new Error(`Nie można połączyć się z backendem (${API_URL}).`);
  }

  const text = await response.text();
  if (response.status === 401 && !path.startsWith("/auth/login")) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  if (!response.ok) {
    let message = text || `Błąd API (${response.status}).`;
    try {
      const body = JSON.parse(text) as ApiErrorBody;
      message = body.details
        ? Object.entries(body.details).map(([field, value]) => `${field}: ${value}`).join(", ")
        : body.error || message;
    } catch { /* odpowiedź nie była JSON-em */ }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type Room = { id: string; code: string; created_at: string; created_by_user_id?: string };
export type Participant = { id: string; room_id: string; name: string; team_id: string | null; joined_at: string };
export type Team = { id: string; room_id: string; name: string; score: number };
export type HistorySummary = { total_events: number; first_day: number | null; last_day: number | null; runs_count: number };
export type Dashboard = { room: Room; participants: Participant[]; teams: Team[]; history: HistorySummary };
export type HistoryEvent = {
  id: string;
  participant_id: string | null;
  run_id: string | null;
  player_name: string | null;
  day_number: number;
  event_type: string;
  choice_key: string | null;
  choice_label: string;
  choice_details: Record<string, unknown> | null;
  effects: Record<string, unknown> | null;
  state_after: Record<string, unknown> | null;
  created_at: string;
};
export type HistoryAnalysis = {
  total_events: number;
  first_day: number | null;
  last_day: number | null;
  events: HistoryEvent[];
};

export async function login(payload: { username: string; password: string; remember_me?: boolean }) {
  const user = await apiFetch<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  clearCsrfToken();
  return user;
}
export async function registerTeacher(payload: { username: string; password: string; display_name: string }) {
  const user = await apiFetch<AuthUser>("/auth/register/teacher", { method: "POST", body: JSON.stringify(payload) });
  clearCsrfToken();
  return user;
}
export function getCurrentUser() { return apiFetch<AuthUser>("/auth/me"); }
export async function logout() {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  clearCsrfToken();
}
export function createRoom() { return apiFetch<Room>("/rooms", { method: "POST" }); }
export function getDashboard(roomId: string) { return apiFetch<Dashboard>(`/teacher/rooms/${roomId}/dashboard`); }
export function getRoomHistory(roomId: string) { return apiFetch<HistoryAnalysis>(`/rooms/${roomId}/history/analysis`); }
