import type { AuthUser } from "./auth";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
export const AUTH_EXPIRED_EVENT = "cashhero:auth-expired";
const CSRF_HEADER = "X-XSRF-TOKEN";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

type ApiErrorBody = { error?: string; code?: string; details?: Record<string, string> };

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

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

function requireStaff(user: AuthUser): AuthUser {
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new Error("To konto ucznia. Zaloguj się kontem nauczyciela.");
  }
  return user;
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
      const body = await response.clone().json().catch(() => null) as ApiErrorBody | null;
      if (body?.code === "INVALID_CSRF_TOKEN") {
        clearCsrfToken();
        headers.set(CSRF_HEADER, await getCsrfToken());
        response = await send();
      }
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
    throw new ApiError(message, response.status);
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
  return requireStaff(user);
}
export async function registerTeacher(payload: {
  username: string;
  password: string;
  display_name: string;
  email: string;
  invitation_token: string;
}) {
  try {
    const user = await apiFetch<AuthUser>("/auth/teacher-invitations/accept", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    clearCsrfToken();
    return requireStaff(user);
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 409) {
      throw new ApiError(
        "Nie można utworzyć konta: login lub adres e-mail jest już używany. Jeśli masz już konto nauczyciela, zaloguj się. W przeciwnym razie wybierz inny login; jeśli konflikt dotyczy e-maila, skontaktuj się z administratorem. Adres e-mail musi być zgodny z zaproszeniem.",
        reason.status,
      );
    }
    throw reason;
  }
}
export function getCurrentUser() { return apiFetch<AuthUser>("/auth/me").then(requireStaff); }
export async function logout() {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  clearCsrfToken();
}
export function createRoom() { return apiFetch<Room>("/rooms", { method: "POST" }); }
export function createTeam(payload: { room_id: string; name: string }) {
  return apiFetch<Team>("/teams", { method: "POST", body: JSON.stringify(payload) });
}
export function getDashboard(roomId: string) { return apiFetch<Dashboard>(`/teacher/rooms/${roomId}/dashboard`); }
export function getRoomHistory(roomId: string) { return apiFetch<HistoryAnalysis>(`/rooms/${roomId}/history/analysis`); }

export type TeacherInvitation = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  delivery_status: string;
  delivery_updated_at: string | null;
};

export type AdminNotification = {
  id: string;
  notification_type: string;
  message: string;
  related_user_id: string | null;
  created_at: string;
  read_at: string | null;
};

export function createTeacherInvitation(email: string) {
  return apiFetch<TeacherInvitation>("/admin/teacher-invitations", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  });
}

export function getTeacherInvitations() {
  return apiFetch<TeacherInvitation[]>("/admin/teacher-invitations");
}

export function revokeTeacherInvitation(invitationId: string) {
  return apiFetch<void>(`/admin/teacher-invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" });
}

export function getAdminNotifications() {
  return apiFetch<AdminNotification[]>("/admin/notifications");
}
