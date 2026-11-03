import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity, AlertCircle, ArrowLeft, BarChart3, Bell, Check, Clock, Copy, DoorOpen,
  GraduationCap, Loader2, LogOut, Play, Plus, Radio, RefreshCw, ShieldCheck, Trash2, Users, Wallet,
} from "lucide-react";
import {
  AUTH_EXPIRED_EVENT, createRoom, createTeacherInvitation, createTeam, getAdminNotifications, getCurrentUser,
  getDashboard, getParticipantEvents, getParticipantLesson, getTeacherInvitations, login, logout, registerTeacher, revokeTeacherInvitation,
  type AdminNotification, type Dashboard, type LessonEffect, type LessonEvent, type LessonParticipant,
  type LessonStatus, type Participant, type ParticipantLesson,
  type TeacherInvitation,
} from "./api";
import { clearLegacyAuthStorage, type AuthUser } from "./auth";

const ROOM_STORAGE_KEY = "cashhero_teacher_room";
const POLL_INTERVAL = 10000;
const FORTNIGHT_DAYS = 14;
const CAREER_DAYS = 84;

type Stage = "waiting" | "live" | "reports";

const statusLabels: Record<LessonStatus, string> = {
  NO_DATA: "Brak danych",
  UNKNOWN: "Status nieustalony",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Ukończono",
  BANKRUPT: "Bankructwo",
};

const metricLabels: Record<LessonEffect["metric"], string> = {
  finances: "Finanse",
  mental_health: "Samopoczucie",
  physical_health: "Zdrowie",
  self_development: "Rozwój",
};

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
const points = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

function progress(day: number | null, totalDays: number) {
  if (day == null) return "—";
  return totalDays === CAREER_DAYS
    ? `Okres ${Math.ceil(day / FORTNIGHT_DAYS)} z ${CAREER_DAYS / FORTNIGHT_DAYS}`
    : `Dzień ${day} z ${totalDays}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const user = mode === "login"
        ? await login({ username, password, remember_me: rememberMe })
        : await registerTeacher({
            username,
            password,
            display_name: displayName,
            email: email.trim(),
            invitation_token: invitationToken.trim(),
          });
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
      {mode === "register" && <Field label="E-mail przypisany do zaproszenia" value={email} onChange={setEmail} type="email" autoComplete="email" />}
      {mode === "register" && <Field label="Jednorazowy kod zaproszenia" value={invitationToken} onChange={setInvitationToken} autoComplete="one-time-code" />}
      {mode === "register" && <p className="mb-4 text-xs text-slate-500">Wklej kod z wiadomości e-mail i podaj adres, na który wysłano zaproszenie. Login musi być wolny, a e-mail nie może być przypisany do innego konta.</p>}
      <Field label="Login" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Hasło" value={password} onChange={setPassword} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {mode === "login" && <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
        Zapamiętaj mnie na 30 dni
      </label>}
      <button disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Zaloguj się" : "Utwórz konto"}
      </button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-4 w-full text-sm font-medium text-indigo-600">
        {mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
      </button>
    </form>
  </main>;
}

function Field({ label, value, onChange, type = "text", autoComplete, required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; required?: boolean }) {
  return <label className="mb-4 block text-sm font-semibold text-slate-700">{label}
    <input required={required} minLength={required ? (type === "password" ? 6 : 3) : undefined} value={value} type={type} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
  </label>;
}

function Notice({ children }: { children: string }) {
  return <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

function Header({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return <header className="border-b border-slate-100 bg-white">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
      <div className="flex items-center gap-2 font-bold text-slate-900"><GraduationCap className="text-indigo-600" />Cash Hero <span className="font-normal text-slate-400">{user.role === "ADMIN" ? "Administrator" : "Nauczyciel"}</span></div>
      <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{user.display_name || user.username}</span><button onClick={onLogout} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"><LogOut className="h-3.5 w-3.5" /> Wyloguj</button></div>
    </div>
  </header>;
}

function AdminPanel({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [email, setEmail] = useState("");
  const [invitation, setInvitation] = useState<TeacherInvitation | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshNotifications = useCallback(async () => {
    try {
      setNotifications(await getAdminNotifications());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się pobrać powiadomień.");
    }
  }, []);

  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);

  const createInvitation = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setInvitation(null);
    try {
      setInvitation(await createTeacherInvitation(email));
      setEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się utworzyć zaproszenia.");
    } finally { setBusy(false); }
  };

  const revokeInvitation = async () => {
    if (!invitation) return;
    setBusy(true); setError("");
    try {
      await revokeTeacherInvitation(invitation.id);
      setInvitation(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się unieważnić zaproszenia.");
    } finally { setBusy(false); }
  };

  const refreshInvitation = async () => {
    if (!invitation) return;
    setBusy(true); setError("");
    try {
      const invitations = await getTeacherInvitations();
      const updated = invitations.find((item) => item.id === invitation.id);
      if (!updated) throw new Error("Nie znaleziono zaproszenia.");
      setInvitation(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się odświeżyć statusu zaproszenia.");
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-50">
    <Header user={user} onLogout={onLogout} />
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ShieldCheck className="text-indigo-600" />Zaproszenia nauczycieli</h1>
        <p className="mt-2 text-sm text-slate-500">Jednorazowy kod zostanie wysłany na adres e-mail nauczyciela. Kod jest dostępny w wiadomości i nie jest wyświetlany w panelu.</p>
        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
        <form onSubmit={createInvitation} className="mt-5">
          <Field label="E-mail nauczyciela" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Utwórz zaproszenie</button>
        </form>
        {invitation && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase text-amber-700">Zaproszenie utworzone</p>
          <p className="mt-2 break-all text-sm text-slate-800">Adresat: {invitation.email}</p>
          <p className="mt-2 text-sm text-slate-700" role="status">Status wysyłki: {invitation.delivery_status === "SENT" ? "Wysłano wiadomość z kodem." : invitation.delivery_status === "PENDING" ? "Oczekuje na wysłanie wiadomości z kodem." : invitation.delivery_status === "FAILED" ? "Nie udało się wysłać wiadomości. Skontaktuj się z administratorem poczty." : "Brak potwierdzenia wysyłki."}</p>
          <p className="mt-2 text-xs text-slate-500">Ważne do {formatDate(invitation.expires_at)}</p>
          {invitation.used_at && <p className="mt-2 text-sm text-slate-700">Zaproszenie wykorzystane.</p>}
          {invitation.revoked_at && <p className="mt-2 text-sm text-slate-700">Zaproszenie unieważnione.</p>}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={refreshInvitation} disabled={busy} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60"><RefreshCw className="h-4 w-4" /> Odśwież status</button><button type="button" onClick={revokeInvitation} disabled={busy || !!invitation.used_at || !!invitation.revoked_at} className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"><Trash2 className="h-4 w-4" /> Unieważnij</button></div>
        </div>}
      </section>
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Bell className="text-indigo-600" />Powiadomienia</h2><button onClick={() => void refreshNotifications()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Odśwież powiadomienia"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="mt-5 space-y-3">{notifications.length === 0 ? <p className="text-sm text-slate-400">Brak powiadomień.</p> : notifications.map((notification) => <article key={notification.id} className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-semibold text-slate-800">{notification.message}</p><time className="mt-1 block text-xs text-slate-400">{formatDate(notification.created_at)}</time></article>)}</div>
      </section>
    </main>
  </div>;
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

function WaitingRoom({ dashboard, error, refreshing, onRefresh, onStart, onNewRoom, onCreateTeam }: { dashboard: Dashboard; error: string; refreshing: boolean; onRefresh: () => void; onStart: () => void; onNewRoom: () => void; onCreateTeam: (name: string) => Promise<void> }) {
  const [teamName, setTeamName] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");

  const submitTeam = async (event: FormEvent) => {
    event.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    setTeamBusy(true); setTeamError("");
    try {
      await onCreateTeam(name);
      setTeamName("");
    } catch (reason) {
      setTeamError(reason instanceof Error ? reason.message : "Nie udało się utworzyć zespołu.");
    } finally { setTeamBusy(false); }
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Poczekalnia</h1><p className="text-sm text-slate-500">Lista odświeża się automatycznie co 4 sekundy.</p></div><button onClick={onNewRoom} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Utwórz inny pokój</button></div>
    {error && <Notice>{error}</Notice>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-500">Kod pokoju</p><RoomCode code={dashboard.room.code} />
        <p className="mt-5 max-w-sm text-sm text-slate-500">Przekaż kod uczniom. Pokój utworzono {formatDate(dashboard.room.created_at)}.</p>
        <div className="mt-7 w-full border-t border-slate-100 pt-6 text-left">
          <h2 className="font-bold text-slate-800">Zespoły ({dashboard.teams.length})</h2>
          {dashboard.teams.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{dashboard.teams.map((team) => <span key={team.id} className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">{team.name}</span>)}</div>}
          <form onSubmit={submitTeam} className="mt-3 flex gap-2">
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={120} placeholder="Nazwa zespołu" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <button disabled={teamBusy || !teamName.trim()} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{teamBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dodaj</button>
          </form>
          {teamError && <p className="mt-2 text-sm text-red-600">{teamError}</p>}
        </div>
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

function StudentTable({ students, onReport }: { students: LessonParticipant[]; onReport: (student: LessonParticipant) => void }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
    <table className="w-full text-left">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
        {["Uczeń", "Status", "Postęp", "Finanse", "Decyzje", "Ostatni zapis", "Raport"].map(label =>
          <th key={label} scope="col" className="px-5 py-3">{label}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100">{students.map(student =>
        <tr key={student.participant_id} className="text-sm">
          <th scope="row" className="px-5 py-4"><p>{student.name}</p><p className="font-normal text-slate-500">{student.team?.name ?? "Bez zespołu"}</p></th>
          <td className="px-5 py-4">{statusLabels[student.status]}</td>
          <td className="px-5 py-4">{progress(student.current_day, student.total_days)}</td>
          <td className={`px-5 py-4 font-mono ${student.finances != null && student.finances < 0 ? "text-red-700" : ""}`}>
            {student.finances == null ? "—" : money.format(student.finances)}
          </td>
          <td className="px-5 py-4">{student.decision_count ?? "—"}</td>
          <td className="px-5 py-4">{student.last_recorded_at ? formatDate(student.last_recorded_at) : "—"}</td>
          <td className="px-5 py-4"><button onClick={() => onReport(student)} className="font-semibold text-indigo-700 hover:underline"
            aria-label={`Raport ucznia ${student.name}`}>Otwórz</button></td>
        </tr>)}</tbody>
    </table>
  </div>;
}

function LiveDashboard({ dashboard, error, onRefresh, onReports, onBack }: {
  dashboard: Dashboard; error: string; onRefresh: () => void; onReports: (student?: LessonParticipant) => void; onBack: () => void;
}) {
  const { participants, summary } = dashboard.lesson;
  const balances = participants.flatMap(student => student.finances == null ? [] : [student.finances]);
  const counts = participants.flatMap(student => student.decision_count == null ? [] : [student.decision_count]);
  const average = balances.length ? balances.reduce((sum, value) => sum + value, 0) / balances.length : null;
  const decisions = counts.length ? counts.reduce((sum, count) => sum + count, 0) : null;

  return <main className="mx-auto max-w-7xl px-4 py-7 md:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-slate-900">Wyniki na żywo</h1>
        <p className="mt-1 text-sm text-slate-500">Pokój <span className="font-mono font-semibold">{dashboard.room.code}</span>
          {" · "}Dane z {formatDate(dashboard.lesson.generated_at)}</p></div>
      <div className="flex gap-2">
        <button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Poczekalnia</button>
        <button onClick={onRefresh} aria-label="Odśwież" className="rounded-lg border p-2"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={() => onReports()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Raport decyzji</button>
      </div>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
      <Metric icon={<Users />} label="Uczestnicy" value={String(summary.participant_count)} />
      <Metric icon={<Check />} label="Ukończone próby" value={String(summary.completed_count)} />
      <Metric icon={<Clock />} label="Brak danych" value={String(summary.no_data_count)} />
      <Metric icon={<Wallet />} label="Średnie finanse" value={average == null ? "—" : money.format(average)} />
      <Metric icon={<Activity />} label="Zapisane decyzje" value={decisions == null ? "—" : String(decisions)} />
    </div>
    <StudentTable students={participants} onReport={onReports} />
  </main>;
}

function eventLabel(event: LessonEvent) {
  switch (event.event_type) {
    case "run_started": return "Start próby";
    case "decision": return "Decyzja";
    case "state_updated": return "Aktualizacja stanu";
    case "run_finished": return "Koniec próby";
    default: return "Zdarzenie";
  }
}

function EventRow({ event, totalDays }: { event: LessonEvent; totalDays: number }) {
  return <li className="rounded-xl bg-slate-50 px-4 py-3">
    <div className="flex flex-wrap justify-between gap-2">
      <p className="text-sm font-semibold">{eventLabel(event)} · {progress(event.day_number, totalDays)} · {event.choice_label}</p>
      <time dateTime={event.recorded_at} className="text-xs text-slate-500">{formatDate(event.recorded_at)}</time>
    </div>
    {event.effects.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      {event.effects.map(({ metric, before, after, delta }) => {
        const formatter = metric === "finances" ? money : points;
        const value = (amount: number | null) => amount == null ? "—" : formatter.format(amount);
        return <li key={metric}>{metricLabels[metric]}: {value(before)} → {value(after)}
          {delta != null && ` (${delta > 0 ? "+" : ""}${value(delta)})`}</li>;
      })}
    </ul>}
  </li>;
}

function StudentReport({ roomId, student }: { roomId: string; student: LessonParticipant }) {
  const [report, setReport] = useState<ParticipantLesson | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    void getParticipantLesson(roomId, student.participant_id, student.run_id, controller.signal)
      .then(result => { if (!controller.signal.aborted) setReport(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => request.current?.abort();
  }, [roomId, student.participant_id, student.run_id, attempt]);

  async function loadMore() {
    const page = report?.recent_events;
    if (!page?.next_cursor || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await getParticipantEvents(roomId, student.participant_id, page.run_id, page.next_cursor, controller.signal);
      if (!controller.signal.aborted) {
        setReport(current => current && ({ ...current, recent_events: { ...next, events: [...page.events, ...next.events] } }));
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać zdarzeń.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const participant = report?.participant ?? student;
  return <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-busy={busy}>
    <h2 className="font-semibold">{participant.name}</h2>
    <p className="mb-4 text-sm text-slate-600">{statusLabels[participant.status]} · {progress(participant.current_day, participant.total_days)}
      {" · "}Decyzje: {participant.decision_count ?? "—"}</p>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {!report && error && <button onClick={() => setAttempt(attempt + 1)} className="font-semibold text-indigo-700">Spróbuj ponownie</button>}
    {report && (report.recent_events.events.length
      ? <ol className="space-y-2">{report.recent_events.events.map(event =>
        <EventRow key={event.id} event={event} totalDays={participant.total_days} />)}</ol>
      : <p className="text-sm text-slate-500">Brak zapisanych zdarzeń.</p>)}
    {busy && <p role="status" className="mt-3 text-sm text-slate-600">Pobieranie zdarzeń…</p>}
    {report?.recent_events.next_cursor && <button onClick={() => void loadMore()} disabled={busy}
      className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">Wczytaj starsze zdarzenia</button>}
  </section>;
}

function Reports({ dashboard, student, onSelect, onBack }: {
  dashboard: Dashboard; student: LessonParticipant | null; onSelect: (student: LessonParticipant | null) => void; onBack: () => void;
}) {
  return <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
    <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-500">
      <ArrowLeft className="h-4 w-4" />Powrót do podglądu
    </button>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="text-indigo-600" />Historia decyzji</h1>
    <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      Uczeń
      <select value={student?.participant_id ?? ""} onChange={event =>
        onSelect(dashboard.lesson.participants.find(item => item.participant_id === event.target.value) ?? null)}
        className="rounded-lg border bg-white px-3 py-2">
        <option value="">Wybierz ucznia</option>
        {dashboard.lesson.participants.map(item => <option key={item.participant_id} value={item.participant_id}>{item.name}</option>)}
      </select>
    </label>
    {student && <StudentReport key={`${student.participant_id}:${student.run_id}`} roomId={dashboard.room.id} student={student} />}
  </main>;
}

export default function TeacherLiveLessonPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reportStudent, setReportStudent] = useState<LessonParticipant | null>(null);
  const dashboardRequest = useRef<AbortController | null>(null);
  const [stage, setStage] = useState<Stage>("waiting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      clearLegacyAuthStorage();
      try { setUser(await getCurrentUser()); }
      catch { setUser(null); }
      finally { setAuthReady(true); }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      dashboardRequest.current?.abort();
      dashboardRequest.current = null;
      setBusy(false);
      setUser(null);
      setDashboard(null);
      setReportStudent(null);
      setStage("waiting");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    const roomId = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!roomId || user?.role !== "TEACHER" || dashboardRequest.current) return;
    const controller = new AbortController();
    dashboardRequest.current = controller;
    if (!quiet) setBusy(true);
    try {
      const nextDashboard = await getDashboard(roomId, controller.signal);
      if (!controller.signal.aborted && localStorage.getItem(ROOM_STORAGE_KEY) === roomId) {
        setDashboard(nextDashboard);
        setError("");
      }
    } catch (reason) {
      if (!controller.signal.aborted && localStorage.getItem(ROOM_STORAGE_KEY) === roomId) {
        setError(reason instanceof Error ? reason.message : "Nie udało się odświeżyć danych pokoju.");
      }
    } finally {
      if (dashboardRequest.current === controller) dashboardRequest.current = null;
      if (!quiet && !controller.signal.aborted) setBusy(false);
    }
  }, [user]);

  useEffect(() => { if (user?.role === "TEACHER") void refresh(); }, [user, refresh]);
  const roomId = dashboard?.room.id;
  useEffect(() => {
    if (!roomId || user?.role !== "TEACHER" || stage === "reports") return;
    const refreshVisible = () => { if (!document.hidden) void refresh(true); };
    const interval = window.setInterval(refreshVisible, POLL_INTERVAL);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [user, roomId, stage, refresh]);

  const handleCreate = async () => {
    dashboardRequest.current?.abort();
    dashboardRequest.current = null;
    setBusy(true);
    setError("");
    try {
      const room = await createRoom();
      localStorage.setItem(ROOM_STORAGE_KEY, room.id);
      await refresh();
      setReportStudent(null);
      setStage("waiting");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się utworzyć pokoju.");
    } finally {
      setBusy(false);
    }
  };
  const handleCreateTeam = async (name: string) => {
    if (!dashboard) return;
    await createTeam({ room_id: dashboard.room.id, name });
    await refresh(true);
  };
  const handleLogout = async () => {
    setError("");
    try {
      await logout();
      dashboardRequest.current?.abort();
      dashboardRequest.current = null;
      localStorage.removeItem(ROOM_STORAGE_KEY);
      setUser(null);
      setDashboard(null);
      setReportStudent(null);
      setStage("waiting");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się wylogować.");
    }
  };
  const handleNewRoom = () => {
    dashboardRequest.current?.abort();
    dashboardRequest.current = null;
    localStorage.removeItem(ROOM_STORAGE_KEY);
    setDashboard(null);
    setReportStudent(null);
    setStage("waiting");
    setError("");
  };

  const openReports = (student?: LessonParticipant) => {
    setReportStudent(student ?? null);
    setStage("reports");
  };

  if (!authReady) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!user) return <AuthScreen onAuthenticated={(next) => { setUser(next); setAuthReady(true); }} />;
  if (user.role === "ADMIN") return <AdminPanel user={user} onLogout={handleLogout} />;

  return <div className="min-h-screen bg-slate-50">
    <Header user={user} onLogout={handleLogout} />
    {!dashboard ? <NoRoom onCreate={handleCreate} busy={busy} error={error} />
      : stage === "waiting" ? <WaitingRoom dashboard={dashboard} error={error} refreshing={busy}
        onRefresh={() => void refresh()} onStart={() => setStage("live")} onNewRoom={handleNewRoom} onCreateTeam={handleCreateTeam} />
      : stage === "live" ? <LiveDashboard dashboard={dashboard} error={error} onRefresh={() => void refresh()}
        onReports={openReports} onBack={() => setStage("waiting")} />
      : <Reports dashboard={dashboard} student={reportStudent} onSelect={setReportStudent}
        onBack={() => { setStage("live"); void refresh(true); }} />}
  </div>;
}
