import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
});
let moduleId = 0;

// Load a fresh API instance so each test has its own CSRF cache, without a bundler.
async function loadApi() {
  const code = outputText.replaceAll("import.meta.env", "({ VITE_API_URL: 'https://api.example.test' })");
  return import(`data:text/javascript;base64,${Buffer.from(`${code}\n// ${moduleId++}`).toString("base64")}`);
}

function mockResponses(t, responses) {
  const pending = [...responses];
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    calls.push({ url, ...init });
    const next = pending.shift();
    assert.ok(next, `Unexpected request: ${url}`);
    assert.equal(url, `https://api.example.test${next.path}`);
    assert.equal(init.method || "GET", next.method || "GET");
    assert.equal(init.credentials, "include");
    return new Response(JSON.stringify(next.body), {
      status: next.status || 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  t.after(() => assert.equal(pending.length, 0, "Expected API requests were not made"));
  return calls;
}

const invitation = {
  id: "invitation-id",
  email: "teacher@example.test",
  created_at: "2026-10-29T12:00:00Z",
  expires_at: "2026-10-31T12:00:00Z",
  used_at: null,
  revoked_at: null,
  delivery_status: "PENDING",
  delivery_updated_at: "2026-10-29T12:00:00Z",
};
const registration = {
  username: "new-teacher",
  password: "test-password",
  display_name: "Teacher",
  email: invitation.email,
  invitation_token: "a".repeat(43),
};

test("creating an invitation accepts email-only delivery metadata without a raw token", async (t) => {
  const api = await loadApi();
  const calls = mockResponses(t, [
    { path: "/auth/csrf", body: { token: "csrf-token" } },
    { path: "/admin/teacher-invitations", method: "POST", status: 201, body: invitation },
  ]);

  assert.deepEqual(await api.createTeacherInvitation(" teacher@example.test "), invitation);
  assert.deepEqual(JSON.parse(calls[1].body), { email: invitation.email });
  assert.equal(calls[1].headers.get("X-XSRF-TOKEN"), "csrf-token");
  assert.equal(calls[1].headers.get("Content-Type"), "application/json");
});

test("refreshing invitations retrieves updated delivery and usage status", async (t) => {
  const api = await loadApi();
  const updated = { ...invitation, delivery_status: "SENT", used_at: "2026-10-29T12:30:00Z" };
  mockResponses(t, [{ path: "/admin/teacher-invitations", body: [updated] }]);

  assert.deepEqual(await api.getTeacherInvitations(), [updated]);
});

test("acceptance forwards the emailed token and email, then clears the old CSRF token", async (t) => {
  const api = await loadApi();
  const user = { id: "teacher-id", username: registration.username, display_name: "Teacher", role: "TEACHER" };
  const calls = mockResponses(t, [
    { path: "/auth/csrf", body: { token: "before-login" } },
    { path: "/auth/teacher-invitations/accept", method: "POST", status: 201, body: user },
    { path: "/auth/csrf", body: { token: "after-login" } },
    { path: "/admin/teacher-invitations", method: "POST", status: 201, body: invitation },
  ]);

  assert.deepEqual(await api.registerTeacher(registration), user);
  assert.deepEqual(JSON.parse(calls[1].body), registration);
  await api.createTeacherInvitation(invitation.email);
  assert.equal(calls[3].headers.get("X-XSRF-TOKEN"), "after-login");
});

test("409 explains login/email conflicts in Polish without retrying acceptance", async (t) => {
  const api = await loadApi();
  const calls = mockResponses(t, [
    { path: "/auth/csrf", body: { token: "csrf-token" } },
    { path: "/auth/teacher-invitations/accept", method: "POST", status: 409, body: { error: "Registration could not be completed" } },
  ]);

  await assert.rejects(api.registerTeacher(registration), (error) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /login lub adres e-mail jest już używany/);
    assert.match(error.message, /zaloguj się/);
    assert.match(error.message, /Adres e-mail musi być zgodny z zaproszeniem/);
    return true;
  });
  assert.equal(calls.length, 2);
});

test("an expired or invalid invitation retains the backend message without retrying", async (t) => {
  const api = await loadApi();
  const message = "zaproszenie nieprawidłowe lub wygasłe";
  mockResponses(t, [
    { path: "/auth/csrf", body: { token: "csrf-token" } },
    { path: "/auth/teacher-invitations/accept", method: "POST", status: 403, body: { error: message } },
  ]);

  await assert.rejects(api.registerTeacher(registration), { message, status: 403 });
});

test("CSRF rejection refreshes the token once and preserves a subsequent registration conflict", async (t) => {
  const api = await loadApi();
  const calls = mockResponses(t, [
    { path: "/auth/csrf", body: { token: "old-token" } },
    { path: "/auth/teacher-invitations/accept", method: "POST", status: 403, body: { code: "INVALID_CSRF_TOKEN" } },
    { path: "/auth/csrf", body: { token: "new-token" } },
    { path: "/auth/teacher-invitations/accept", method: "POST", status: 409, body: { error: "Registration could not be completed" } },
  ]);

  await assert.rejects(api.registerTeacher(registration), /login lub adres e-mail jest już używany/);
  assert.equal(calls[3].headers.get("X-XSRF-TOKEN"), "new-token");
  assert.equal(calls[3].body, calls[1].body);
});
