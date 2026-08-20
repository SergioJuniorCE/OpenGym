import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

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

function startRuntime(dataDir: string, environment: NodeJS.ProcessEnv = {}): ApiRuntime {
  const runtime = createApp({
    DATA_DIR: dataDir,
    ORIGIN: 'http://localhost:8080',
    RP_ID: 'localhost',
    ...environment,
  });
  runtimes.push(runtime);
  return runtime;
}

function signSession(secret: string, userId: string, version = 0): string {
  const payload = `${userId}:${Date.now() + 60_000}:${version}`;
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

test('public routes preserve JSON headers, config, exact methods, and 404s', async () => {
  const runtime = startRuntime(temporaryDataDirectory(), { INVITE_ONLY: 'true' });

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

test('signed sessions isolate state and logout-all revokes existing cookies', async () => {
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

  const runtime = startRuntime(dataDir, { ADMIN_UIDS: user.id });
  const session = signSession(secret, user.id);
  const headers = { Cookie: `gymsid=${session}` };

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
  assert.match(logout.headers.get('set-cookie') || '', /^gymsid=; Path=\/; Max-Age=0;/);

  const revoked = await runtime.app.request('/api/me', { headers });
  assert.equal(revoked.status, 401);
  assert.deepEqual(await revoked.json(), { error: 'not signed in' });

  const database = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8')) as {
    users: Array<{ sv?: number }>;
  };
  assert.equal(database.users[0]?.sv, 1);
});

test('request bodies larger than 5 MiB fail without reaching a route handler', async () => {
  const runtime = startRuntime(temporaryDataDirectory());
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const response = await runtime.app.request('/api/register/options', {
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
