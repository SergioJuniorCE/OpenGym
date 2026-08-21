import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { makeSignature } from 'better-auth/crypto';
import Database from 'better-sqlite3';

import { createApp, type ApiRuntime } from './app.ts';

const temporaryDirectories: string[] = [];
const runtimes: ApiRuntime[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDataDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opengym-api-'));
  temporaryDirectories.push(directory);
  return directory;
}

function sessionCookie(response: Response): string {
  const value = response.headers.get('set-cookie') || '';
  const match = value.match(/(?:^|,\s*)better-auth\.session_token=([^;,]+)/);
  return match ? `better-auth.session_token=${match[1]}` : '';
}

async function startRuntime(dataDir: string, environment: NodeJS.ProcessEnv = {}): Promise<ApiRuntime> {
  const runtime = await createApp({
    DATA_DIR: dataDir,
    ORIGIN: 'http://localhost:8080',
    RP_ID: 'localhost',
    ...environment,
  });
  runtimes.push(runtime);
  return runtime;
}

test('public routes preserve JSON headers, config, exact methods, and 404s', async () => {
  const runtime = await startRuntime(temporaryDataDirectory(), { INVITE_ONLY: 'true' });

  const health = await runtime.app.request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('content-type'), 'application/json');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), { ok: true, users: 0 });

  const config = await runtime.app.request('/api/config');
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), { invite_only: true });

  const head = await runtime.app.request('/api/health', { method: 'HEAD' });
  assert.equal(head.status, 404);

  const missing = await runtime.app.request('/api/missing');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'not found' });
});

test('Better Auth exposes the passkey ceremony through Hono', async () => {
  const runtime = await startRuntime(temporaryDataDirectory());
  const contextResponse = await runtime.app.request('/api/register/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada' }),
  });
  assert.equal(contextResponse.status, 200);
  const registrationContext = (await contextResponse.json() as { context: string }).context;

  const optionsResponse = await runtime.app.request(
    `/api/auth/passkey/generate-register-options?name=Ada&context=${encodeURIComponent(registrationContext)}`,
    { headers: { Origin: 'http://localhost:8080' } },
  );
  assert.equal(optionsResponse.status, 200);
  const options = await optionsResponse.json() as { challenge?: string; rp?: { id?: string } };
  assert.equal(typeof options.challenge, 'string');
  assert.equal(options.rp?.id, 'localhost');
});

test('email sign-up creates an app profile and email sign-in restores it', async () => {
  const runtime = await startRuntime(temporaryDataDirectory());
  const signup = await runtime.app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: 'http://localhost:8080', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'password123' }),
  });
  assert.equal(signup.status, 200);
  const signupCookie = sessionCookie(signup);
  assert.match(signupCookie, /better-auth\.session_token=/);

  const me = await runtime.app.request('/api/me', { headers: { Cookie: signupCookie } });
  assert.deepEqual(await me.json(), {
    user: { id: (await signup.clone().json() as { user: { id: string } }).user.id, name: 'Ada', admin: false },
  });

  const logout = await runtime.app.request('/api/logout', {
    method: 'POST',
    headers: { Cookie: signupCookie },
  });
  assert.equal(logout.status, 200);

  const signin = await runtime.app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { Origin: 'http://localhost:8080', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'password123' }),
  });
  assert.equal(signin.status, 200);
  const signinMe = await runtime.app.request('/api/me', {
    headers: { Cookie: sessionCookie(signin) },
  });
  assert.equal(signinMe.status, 200);
  assert.equal((await signinMe.json() as { user: { name: string } }).user.name, 'Ada');
});

test('invite-only email sign-up requires and consumes a registration context', async () => {
  const dataDir = temporaryDataDirectory();
  fs.writeFileSync(
    path.join(dataDir, 'db.json'),
    JSON.stringify({ users: [], creds: [], subs: [], invites: [{ code: 'ABC123', created: '2026-01-01T00:00:00.000Z' }] }),
  );
  const runtime = await startRuntime(dataDir, { INVITE_ONLY: 'true' });

  const rejected = await runtime.app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: 'http://localhost:8080', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'password123' }),
  });
  assert.equal(rejected.status, 403);

  const context = await runtime.app.request('/api/register/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', code: 'ABC123' }),
  });
  assert.equal(context.status, 200);
  const contextCookies = (context.headers.get('set-cookie') || '')
    .split(',')
    .map(value => value.split(';')[0])
    .join('; ');
  const signup = await runtime.app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:8080',
      'Content-Type': 'application/json',
      Cookie: contextCookies,
    },
    body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'password123' }),
  });
  assert.equal(signup.status, 200);
  const database = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8')) as {
    users: Array<{ invitedBy?: string }>;
    invites: Array<{ usedBy?: string }>;
  };
  assert.equal(database.users[0]?.invitedBy, 'ABC123');
  assert.ok(database.invites[0]?.usedBy);
});

test('legacy identities migrate to Better Auth and logout-all revokes sessions', async () => {
  const dataDir = temporaryDataDirectory();
  const secret = 'test-session-secret';
  const user = { id: 'user_one', name: 'Ada', created: '2026-01-01T00:00:00.000Z' };
  fs.writeFileSync(path.join(dataDir, 'secret'), secret);
  fs.writeFileSync(
    path.join(dataDir, 'db.json'),
    JSON.stringify({ users: [user], creds: [], subs: [], invites: [] }),
  );
  fs.writeFileSync(
    path.join(dataDir, 'state-user_one.json'),
    JSON.stringify({ _ts: 10, active: { exercise: 2 }, workouts: [] }),
  );

  const runtime = await startRuntime(dataDir, { ADMIN_UIDS: user.id });
  const legacyCookie = await runtime.app.request('/api/me', { headers: { Cookie: 'gymsid=legacy' } });
  assert.equal(legacyCookie.status, 401);
  const context = await runtime.auth.$context;
  const session = await context.internalAdapter.createSession(user.id);
  const signedSession = `${session.token}.${await makeSignature(session.token, secret)}`;
  const headers = { Cookie: `better-auth.session_token=${signedSession}` };

  const me = await runtime.app.request('/api/me', { headers });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    user: { id: user.id, name: user.name, admin: true },
  });

  const stateResponse = await runtime.app.request('/api/data', { headers });
  assert.deepEqual(await stateResponse.json(), {
    state: { _ts: 10, active: { exercise: 2 }, workouts: [] },
  });

  const saveResponse = await runtime.app.request('/api/data', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ state: { _ts: 11, active: { exercise: 3 }, workouts: [] } }),
  });
  assert.equal(saveResponse.status, 200);
  assert.deepEqual(await saveResponse.json(), { ok: true, ts: 11 });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'state-user_one.json'), 'utf8')), {
    _ts: 11,
    workouts: [],
  });

  const logout = await runtime.app.request('/api/logout/all', { method: 'POST', headers });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /better-auth\.session_token=/);

  const revoked = await runtime.app.request('/api/me', { headers });
  assert.equal(revoked.status, 401);
  assert.deepEqual(await revoked.json(), { error: 'not signed in' });

  const authDatabase = new Database(path.join(dataDir, 'auth.db'), { readonly: true });
  const authUserCount = authDatabase.prepare('SELECT COUNT(*) AS count FROM "user"').get() as
    | { count: number }
    | undefined;
  assert.equal(authUserCount?.count, 1);
  authDatabase.close();
});

test('request bodies larger than 5 MiB fail without reaching a route handler', async () => {
  const runtime = await startRuntime(temporaryDataDirectory());
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const response = await runtime.app.request('/api/register/context', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', padding: 'x'.repeat(5 * 1024 * 1024) }),
    });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'server error' });
  } finally {
    console.error = originalConsoleError;
  }
});
