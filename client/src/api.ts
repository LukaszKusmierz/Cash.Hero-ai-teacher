import { getAuthToken, storeAuth, type AuthUser } from "./auth";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

type ApiErrorBody = { error?: string; details?: Record<string, string> };

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Nie można połączyć się z backendem (${API_URL}).`);
  }

  const text = await response.text();
  if (response.status === 401) storeAuth(null);
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

export function login(payload: { username: string; password: string }) {
  return apiFetch<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}
export function registerTeacher(payload: { username: string; password: string; display_name: string }) {
  return apiFetch<AuthUser>("/auth/register/teacher", { method: "POST", body: JSON.stringify(payload) });
}
export function getCurrentUser() { return apiFetch<AuthUser>("/auth/me"); }
export function logout() { return apiFetch<void>("/auth/logout", { method: "POST" }); }
export function createRoom() { return apiFetch<Room>("/rooms", { method: "POST" }); }
export function getDashboard(roomId: string) { return apiFetch<Dashboard>(`/teacher/rooms/${roomId}/dashboard`); }
export function getRoomHistory(roomId: string) { return apiFetch<HistoryAnalysis>(`/rooms/${roomId}/history/analysis`); }
