import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertCircle, ArrowLeft, BarChart3, Check, Clock, Copy, DoorOpen,
  FileText, GraduationCap, Loader2, LogOut, Play, Radio, RefreshCw, Users, Wallet,
} from "lucide-react";
import {
  createRoom, getCurrentUser, getDashboard, getRoomHistory, login, logout, registerTeacher,
  type Dashboard, type HistoryAnalysis, type HistoryEvent, type Participant,
} from "./api";
import { getStoredAuth, storeAuth, type AuthUser } from "./auth";

const ROOM_STORAGE_KEY = "cashhero_teacher_room";
const POLL_INTERVAL = 4000;

type Stage = "waiting" | "live" | "reports";
type Student = Participant & {
  day: number | null;
  finances: number | null;
  mentalHealth: number | null;
  physicalHealth: number | null;
  selfDevelopment: number | null;
  events: HistoryEvent[];
};

function numberFrom(object: Record<string, unknown> | null, key: string): number | null {
  const value = object?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildStudents(dashboard: Dashboard, history: HistoryAnalysis | null): Student[] {
  const events = history?.events ?? [];
  return dashboard.participants.map((participant) => {
    const participantEvents = events
      .filter((event) => event.participant_id === participant.id || (!event.participant_id && event.player_name === participant.name))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latest = participantEvents[participantEvents.length - 1];
    return {
      ...participant,
      day: numberFrom(latest?.state_after ?? null, "day") ?? latest?.day_number ?? null,
      finances: numberFrom(latest?.state_after ?? null, "finances"),
      mentalHealth: numberFrom(latest?.state_after ?? null, "mental_health"),
      physicalHealth: numberFrom(latest?.state_after ?? null, "physical_health"),
      selfDevelopment: numberFrom(latest?.state_after ?? null, "self_development"),
      events: participantEvents,
    };
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const user = mode === "login"
        ? await login({ username, password })
        : await registerTeacher({ username, password, display_name: displayName });
      storeAuth(user);
      onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zalogować.");
    } finally { setBusy(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><GraduationCap /></div>
        <div><h1 className="text-xl font-bold text-slate-900">Cash Hero — Nauczyciel</h1><p className="text-sm text-slate-500">To samo konto, co w aplikacji Cash Hero</p></div>
      </div>
      {error && <Notice>{error}</Notice>}
      {mode === "register" && <Field label="Nazwa wyświetlana" value={displayName} onChange={setDisplayName} autoComplete="name" />}
      <Field label="Login" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Hasło" value={password} onChange={setPassword} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
      <button disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Zaloguj się" : "Utwórz konto"}
      </button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-4 w-full text-sm font-medium text-indigo-600">
        {mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
      </button>
    </form>
  </main>;
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <label className="mb-4 block text-sm font-semibold text-slate-700">{label}
    <input required minLength={type === "password" ? 6 : 3} value={value} type={type} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
  </label>;
}

function Notice({ children }: { children: string }) {
  return <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

function Header({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return <header className="border-b border-slate-100 bg-white">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
      <div className="flex items-center gap-2 font-bold text-slate-900"><GraduationCap className="text-indigo-600" />Cash Hero <span className="font-normal text-slate-400">Nauczyciel</span></div>
      <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{user.display_name || user.username}</span><button onClick={onLogout} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"><LogOut className="h-3.5 w-3.5" /> Wyloguj</button></div>
    </div>
  </header>;
}

function NoRoom({ onCreate, busy, error }: { onCreate: () => void; busy: boolean; error: string }) {
  return <div className="mx-auto max-w-xl px-4 py-20 text-center">
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50"><DoorOpen className="h-8 w-8 text-indigo-600" /></div>
    <h1 className="text-2xl font-bold text-slate-900">Utwórz pokój lekcyjny</h1>
    <p className="mt-2 text-slate-500">Backend wygeneruje kod, którym uczniowie dołączą do tej lekcji.</p>
    {error && <div className="mt-5"><Notice>{error}</Notice></div>}
    <button onClick={onCreate} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Utwórz pokój</button>
  </div>;
}

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch { /* schowek może być niedostępny poza HTTPS */ }
  };
  return <button onClick={copy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-mono text-2xl font-bold tracking-[0.25em] text-white shadow-md">{code}{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</button>;
}

function WaitingRoom({ dashboard, error, refreshing, onRefresh, onStart, onNewRoom }: { dashboard: Dashboard; error: string; refreshing: boolean; onRefresh: () => void; onStart: () => void; onNewRoom: () => void }) {
  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Poczekalnia</h1><p className="text-sm text-slate-500">Lista odświeża się automatycznie co 4 sekundy.</p></div><button onClick={onNewRoom} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Utwórz inny pokój</button></div>
    {error && <Notice>{error}</Notice>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-500">Kod pokoju</p><RoomCode code={dashboard.room.code} />
        <p className="mt-5 max-w-sm text-sm text-slate-500">Przekaż kod uczniom. Pokój utworzono {formatDate(dashboard.room.created_at)}.</p>
      </section>
      <section className="flex min-h-96 flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-slate-800"><Users className="h-5 w-5 text-indigo-600" />Uczestnicy ({dashboard.participants.length})</h2><button onClick={onRefresh} disabled={refreshing} aria-label="Odśwież" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button></div>
        <div className="flex-1 space-y-2 overflow-auto">{dashboard.participants.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-slate-400"><Radio className="mb-3 h-9 w-9 animate-pulse text-indigo-300" /><p>Oczekiwanie na uczniów…</p></div> : dashboard.participants.map((participant) => <ParticipantRow key={participant.id} participant={participant} dashboard={dashboard} />)}</div>
        <button onClick={onStart} disabled={!dashboard.participants.length} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Play className="h-4 w-4" /> Przejdź do podglądu ({dashboard.participants.length})</button>
      </section>
    </div>
  </main>;
}

function ParticipantRow({ participant, dashboard }: { participant: Participant; dashboard: Dashboard }) {
  const team = dashboard.teams.find((item) => item.id === participant.team_id);
  return <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{participant.name.charAt(0).toUpperCase()}</div><div><p className="text-sm font-semibold text-slate-800">{participant.name}</p><p className="text-xs text-slate-400">{team ? `Zespół: ${team.name}` : `Dołączył(a): ${formatDate(participant.joined_at)}`}</p></div></div><span className="h-2 w-2 rounded-full bg-green-500" /></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-2 text-indigo-600">{icon}</div><p className="text-xs text-slate-400">{label}</p><p className="font-mono text-xl font-bold text-slate-800">{value}</p></div>;
}

function StudentTable({ students, dashboard }: { students: Student[]; dashboard: Dashboard }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="px-5 py-3">Uczeń</th><th className="px-5 py-3">Dzień</th><th className="px-5 py-3">Finanse</th><th className="px-5 py-3">Zdrowie psychiczne</th><th className="px-5 py-3">Decyzje</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id}><td className="px-5 py-4"><p className="font-semibold text-slate-800">{student.name}</p><p className="text-xs text-slate-400">{dashboard.teams.find((team) => team.id === student.team_id)?.name || "Bez zespołu"}</p></td><td className="px-5 py-4 font-mono text-sm">{student.day ?? "—"}</td><td className={`px-5 py-4 font-mono text-sm font-semibold ${student.finances != null && student.finances < 0 ? "text-red-600" : "text-green-600"}`}>{student.finances == null ? "—" : `${student.finances} zł`}</td><td className="px-5 py-4 font-mono text-sm">{student.mentalHealth == null ? "—" : `${student.mentalHealth}%`}</td><td className="px-5 py-4 font-mono text-sm">{student.events.length}</td></tr>)}</tbody></table></div></div>;
}

function LiveDashboard({ dashboard, history, error, onRefresh, onReports, onBack }: { dashboard: Dashboard; history: HistoryAnalysis | null; error: string; onRefresh: () => void; onReports: () => void; onBack: () => void }) {
  const students = useMemo(() => buildStudents(dashboard, history), [dashboard, history]);
  const withFinances = students.filter((student) => student.finances != null);
  const average = withFinances.length ? Math.round(withFinances.reduce((sum, student) => sum + (student.finances ?? 0), 0) / withFinances.length) : null;
  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">Wyniki na żywo</h1><span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-bold uppercase text-red-600"><Radio className="h-3 w-3" />Live</span></div><p className="mt-1 text-sm text-slate-500">Pokój <span className="font-mono font-semibold">{dashboard.room.code}</span> · dane z backendu</p></div><div className="flex gap-2"><button onClick={onBack} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Poczekalnia</button><button onClick={onRefresh} className="rounded-lg border border-slate-200 p-2 text-slate-500"><RefreshCw className="h-4 w-4" /></button><button onClick={onReports} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Raport decyzji</button></div></div>
    {error && <Notice>{error}</Notice>}
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4"><Metric icon={<Users />} label="Uczestnicy" value={String(students.length)} /><Metric icon={<Wallet />} label="Średnie finanse" value={average == null ? "—" : `${average} zł`} /><Metric icon={<Activity />} label="Zapisane decyzje" value={String(history?.total_events ?? dashboard.history.total_events)} /><Metric icon={<Clock />} label="Ostatni dzień" value={String(history?.last_day ?? dashboard.history.last_day ?? "—")} /></div>
    <StudentTable students={students} dashboard={dashboard} />
  </main>;
}

function Reports({ dashboard, history, onBack }: { dashboard: Dashboard; history: HistoryAnalysis | null; onBack: () => void }) {
  const students = buildStudents(dashboard, history);
  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8"><button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" />Powrót do podglądu</button><div className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><BarChart3 className="text-indigo-600" />Historia decyzji</h1><p className="mt-1 text-sm text-slate-500">{history?.total_events ?? 0} zdarzeń zapisanych dla pokoju {dashboard.room.code}</p></div><div className="space-y-5">{students.map((student) => <section key={student.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><FileText className="h-4 w-4 text-indigo-600" />{student.name}<span className="font-normal text-slate-400">({student.events.length})</span></h2>{student.events.length === 0 ? <p className="text-sm text-slate-400">Brak zapisanych decyzji.</p> : <ol className="space-y-2">{student.events.map((event) => <li key={event.id} className="rounded-xl bg-slate-50 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">Dzień {event.day_number}: {event.choice_label}</p><time className="text-xs text-slate-400">{formatDate(event.created_at)}</time></div>{typeof event.choice_details?.impact === "string" && <p className="mt-1 text-xs text-slate-500">{event.choice_details.impact}</p>}</li>)}</ol>}</section>)}</div></main>;
}

export default function TeacherLiveLessonPanel() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuth());
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<HistoryAnalysis | null>(null);
  const [stage, setStage] = useState<Stage>("waiting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      const stored = getStoredAuth();
      if (!stored?.token) { setUser(null); setAuthReady(true); return; }
      try { const current = await getCurrentUser(); const authenticated = { ...current, token: stored.token }; storeAuth(authenticated); setUser(authenticated); }
      catch { storeAuth(null); setUser(null); }
      finally { setAuthReady(true); }
    };
    void bootstrap();
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    const roomId = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!roomId || !user) return;
    if (!quiet) setBusy(true);
    try {
      const [nextDashboard, nextHistory] = await Promise.all([getDashboard(roomId), getRoomHistory(roomId)]);
      setDashboard(nextDashboard); setHistory(nextHistory); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się odświeżyć danych pokoju."); }
    finally { if (!quiet) setBusy(false); }
  }, [user]);

  useEffect(() => { if (user) void refresh(); }, [user, refresh]);
  useEffect(() => {
    if (!user || !dashboard || stage === "reports") return;
    const interval = window.setInterval(() => void refresh(true), POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [user, dashboard, stage, refresh]);

  const handleCreate = async () => {
    setBusy(true); setError("");
    try { const room = await createRoom(); localStorage.setItem(ROOM_STORAGE_KEY, room.id); const next = await getDashboard(room.id); setDashboard(next); setHistory(null); setStage("waiting"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się utworzyć pokoju."); }
    finally { setBusy(false); }
  };
  const handleLogout = async () => { try { await logout(); } catch { /* sesja lokalna też zostanie wyczyszczona */ } storeAuth(null); localStorage.removeItem(ROOM_STORAGE_KEY); setUser(null); setDashboard(null); };
  const handleNewRoom = () => { localStorage.removeItem(ROOM_STORAGE_KEY); setDashboard(null); setHistory(null); setStage("waiting"); setError(""); };

  if (!authReady) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!user) return <AuthScreen onAuthenticated={(next) => { setUser(next); setAuthReady(true); }} />;
  return <div className="min-h-screen bg-slate-50"><Header user={user} onLogout={handleLogout} />{!dashboard ? <NoRoom onCreate={handleCreate} busy={busy} error={error} /> : stage === "waiting" ? <WaitingRoom dashboard={dashboard} error={error} refreshing={busy} onRefresh={() => void refresh()} onStart={() => setStage("live")} onNewRoom={handleNewRoom} /> : stage === "live" ? <LiveDashboard dashboard={dashboard} history={history} error={error} onRefresh={() => void refresh()} onReports={() => setStage("reports")} onBack={() => setStage("waiting")} /> : <Reports dashboard={dashboard} history={history} onBack={() => setStage("live")} />}</div>;
}
