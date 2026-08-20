import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import webpush from 'web-push';

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_DIR = '/data';
const DEFAULT_RP_ID = 'localhost';
const DEFAULT_ORIGIN = 'http://localhost:8080';
const DEFAULT_RP_NAME = 'openGym';
const DEFAULT_SESSION_DAYS = 90;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const PRESENCE_TTL_MS = 70_000;

type JsonObject = Record<string, unknown>;
type RegistrationCredential = Parameters<typeof verifyRegistrationResponse>[0]['response'];
type AuthenticationCredential = Parameters<typeof verifyAuthenticationResponse>[0]['response'];
type AuthenticationVerificationOptions = Parameters<typeof verifyAuthenticationResponse>[0];

interface User {
  id: string;
  name: string;
  created?: string;
  admin?: boolean;
  disabled?: boolean;
  invitedBy?: string;
  lastReminder?: string;
  sv?: number;
}

interface CredentialRecord {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
}

interface SubscriptionKeys {
  auth: string;
  p256dh: string;
}

interface SubscriptionRecord {
  userId: string;
  endpoint: string;
  keys: SubscriptionKeys;
  created: string;
}

interface Invite {
  code: string;
  note?: string;
  createdBy?: string;
  created?: string;
  revoked?: boolean;
  usedBy?: string;
  usedAt?: string;
}

interface Database {
  users: User[];
  creds: CredentialRecord[];
  subs: SubscriptionRecord[];
  invites: Invite[];
}

interface Routine {
  id: string;
  name?: string;
  emoji?: string;
  ex?: unknown[];
}

interface Workout {
  d?: string;
}

interface PersistedState {
  _ts?: unknown;
  unit?: unknown;
  dayPlan?: Record<string, string>;
  week?: Array<string | null>;
  routines?: Routine[];
  workouts?: Workout[];
  bodyweight?: unknown[];
  reminder?: {
    on?: boolean;
    time?: string;
    tz?: string;
  };
  [key: string]: unknown;
}

interface Challenge {
  challenge: string;
  code?: string;
  exp: number;
  name?: string;
  uid?: string;
}

interface Presence {
  name: string;
  exIdx: number;
  exTotal: number;
  setsDone: number;
  setsTotal: number;
  startedAt: number;
  updatedAt: number;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushPayload {
  title: string;
  body: string;
  tag: string;
}

interface PushError {
  statusCode?: number;
  body?: unknown;
  message?: string;
}

export interface ApiConfig {
  port: number;
  dataDir: string;
  rpId: string;
  origin: string;
  rpName: string;
  adminUids: string[];
  inviteOnly: boolean;
  sessionDays: number;
  maxBodyBytes: number;
  secureCookies: boolean;
  vapidSubject: string;
}

export interface ApiRuntime {
  app: Hono;
  config: ApiConfig;
  dispose: () => void;
}

function resolveConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const origin = environment.ORIGIN || DEFAULT_ORIGIN;
  const secureCookies = /^https:/i.test(origin);

  return {
    port: Number(environment.PORT || DEFAULT_PORT),
    dataDir: environment.DATA_DIR || DEFAULT_DATA_DIR,
    rpId: environment.RP_ID || DEFAULT_RP_ID,
    origin,
    rpName: environment.RP_NAME || DEFAULT_RP_NAME,
    adminUids: (environment.ADMIN_UIDS || '')
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean),
    inviteOnly: /^(1|true|yes|on)$/i.test(environment.INVITE_ONLY || ''),
    sessionDays: Math.max(
      1,
      Number(environment.SESSION_DAYS || DEFAULT_SESSION_DAYS) || DEFAULT_SESSION_DAYS,
    ),
    maxBodyBytes: MAX_BODY_BYTES,
    secureCookies,
    vapidSubject:
      environment.VAPID_SUBJECT || (secureCookies ? origin : 'mailto:admin@localhost'),
  };
}

function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');

  return new Response(JSON.stringify(data), { status, headers });
}

function atomicWrite(file: string, content: string): void {
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, content);
  fs.renameSync(temporaryFile, file);
}

function asRecord(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null ? (value as JsonObject) : null;
}

function errorMessage(error: unknown): string {
  return String(asRecord(error)?.message);
}

async function readJsonBody(request: Request, maxBytes: number): Promise<JsonObject> {
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('body too large');
    }
    chunks.push(value);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')) as JsonObject;
  } catch {
    throw new Error('bad json');
  }
}

function loadDatabase(dbFile: string): Database {
  let database: Database = { users: [], creds: [], subs: [], invites: [] };
  try {
    database = JSON.parse(fs.readFileSync(dbFile, 'utf8')) as Database;
  } catch {
    // A missing or unreadable database is a fresh instance, matching the legacy server.
  }
  database.subs = database.subs || [];
  database.invites = database.invites || [];
  return database;
}

function loadVapidKeys(vapidFile: string): VapidKeys {
  try {
    return JSON.parse(fs.readFileSync(vapidFile, 'utf8')) as VapidKeys;
  } catch {
    const vapid = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidFile, JSON.stringify(vapid), { mode: 0o600 });
    return vapid;
  }
}

/**
 * Builds the complete API without opening a socket. The Node entrypoint is deliberately separate,
 * so route behavior can be exercised through Hono's `app.request()` seam.
 */
export function createApp(environment: NodeJS.ProcessEnv = process.env): ApiRuntime {
  const config = resolveConfig(environment);
  fs.mkdirSync(config.dataDir, { recursive: true });

  const secretFile = path.join(config.dataDir, 'secret');
  if (!fs.existsSync(secretFile)) {
    fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  const secret = fs.readFileSync(secretFile, 'utf8').trim();

  const dbFile = path.join(config.dataDir, 'db.json');
  const database = loadDatabase(dbFile);
  const stateFile = (uid: string): string =>
    path.join(config.dataDir, `state-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
  const readState = (uid: string): PersistedState | null => {
    try {
      return JSON.parse(fs.readFileSync(stateFile(uid), 'utf8')) as PersistedState;
    } catch {
      return null;
    }
  };
  const saveDatabase = (): void => atomicWrite(dbFile, JSON.stringify(database, null, 2));

  const vapid = loadVapidKeys(path.join(config.dataDir, 'vapid.json'));
  webpush.setVapidDetails(config.vapidSubject, vapid.publicKey, vapid.privateKey);

  const isAdmin = (user: User | null | undefined): boolean =>
    Boolean(user && (user.admin === true || config.adminUids.includes(user.id)));

  const sendPush = async (userId: string, payload: PushPayload): Promise<void> => {
    const subscriptions = database.subs.filter((subscription) => subscription.userId === userId);
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    let dirty = false;
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            body,
            {
              urgency: 'high',
              vapidDetails: {
                subject: config.vapidSubject,
                publicKey: vapid.publicKey,
                privateKey: vapid.privateKey,
              },
            },
          );
        } catch (error) {
          const pushError = error as PushError;
          console.error(
            'push send failed',
            userId,
            pushError.statusCode,
            pushError.body || pushError.message,
          );
          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            database.subs = database.subs.filter(
              (candidate) => candidate.endpoint !== subscription.endpoint,
            );
            dirty = true;
          }
        }
      }),
    );
    if (dirty) saveDatabase();
  };

  const restTimers = new Map<string, NodeJS.Timeout>();
  const scheduleRestTimer = (userId: string, seconds: number): void => {
    const currentTimer = restTimers.get(userId);
    if (currentTimer) clearTimeout(currentTimer);
    restTimers.set(
      userId,
      setTimeout(() => {
        restTimers.delete(userId);
        void sendPush(userId, {
          title: 'Rest over 💪',
          body: 'Time for your next set.',
          tag: 'rest-timer',
        });
      }, seconds * 1000),
    );
  };
  const cancelRestTimer = (userId: string): void => {
    const timer = restTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      restTimers.delete(userId);
    }
  };

  const effectiveRoutineId = (state: PersistedState, isoDate: string): string | null => {
    const override = state.dayPlan?.[isoDate];
    if (override === 'rest') return null;
    if (override && state.routines?.some((routine) => routine.id === override)) return override;
    const weekday = new Date(`${isoDate}T12:00:00`).getDay();
    return state.week?.[weekday] || null;
  };

  const userNow = (timeZone: string): { date: string; hhmm: string } | null => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(new Date());
      const getPart = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
        parts.find((part) => part.type === type)?.value;
      return {
        date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
        hhmm: `${getPart('hour')}:${getPart('minute')}`,
      };
    } catch {
      return null;
    }
  };

  const challenges = new Map<string, Challenge>();
  const putChallenge = (data: Omit<Challenge, 'exp'>): string => {
    const id = crypto.randomBytes(16).toString('base64url');
    challenges.set(id, { ...data, exp: Date.now() + 5 * 60_000 });
    return id;
  };
  const takeChallenge = (id: string): Challenge | null => {
    const challenge = challenges.get(id);
    challenges.delete(id);
    if (!challenge || challenge.exp < Date.now()) return null;
    return challenge;
  };

  const sign = (payload: string): string => {
    const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  };
  const verifySignature = (token: string): string | null => {
    const separator = token.lastIndexOf('.');
    if (separator < 0) return null;
    const payload = token.slice(0, separator);
    const mac = token.slice(separator + 1);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    } catch {
      return null;
    }
    return payload;
  };
  const sessionVersion = (user: User): number => user.sv || 0;
  const makeSession = (user: User): string => {
    const expiry = Date.now() + config.sessionDays * 86_400_000;
    return sign(`${user.id}:${expiry}:${sessionVersion(user)}`);
  };
  const readSession = (cookieHeader: string | undefined): User | null => {
    const cookies = Object.fromEntries(
      (cookieHeader || '').split(';').map((cookie) => {
        const separator = cookie.indexOf('=');
        return separator < 0
          ? ['', '']
          : [cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim()];
      }),
    );
    const token = cookies.gymsid;
    if (!token) return null;
    const payload = verifySignature(token);
    if (!payload) return null;
    const [uid, expiry, version] = payload.split(':');
    if (!uid || Number(expiry) < Date.now()) return null;
    const user = database.users.find((candidate) => candidate.id === uid) || null;
    if (!user || user.disabled) return null;
    const claimedVersion = version === undefined ? 0 : Number(version);
    if (!Number.isInteger(claimedVersion) || claimedVersion !== sessionVersion(user)) return null;
    return user;
  };
  const sessionCookie = (user: User): string => {
    const secure = config.secureCookies ? ' Secure;' : '';
    return `gymsid=${makeSession(user)}; Path=/; Max-Age=${config.sessionDays * 86_400}; HttpOnly;${secure} SameSite=Lax`;
  };
  const clearCookie = `gymsid=; Path=/; Max-Age=0; HttpOnly;${config.secureCookies ? ' Secure;' : ''} SameSite=Lax`;

  const presence = new Map<string, Presence>();
  const livePresence = (uid: string): Presence | null => {
    const currentPresence = presence.get(uid);
    if (!currentPresence) return null;
    if (Date.now() - currentPresence.updatedAt > PRESENCE_TTL_MS) {
      presence.delete(uid);
      return null;
    }
    return currentPresence;
  };

  const intervals: NodeJS.Timeout[] = [];
  intervals.push(
    setInterval(() => {
      for (const user of database.users) {
        if (!database.subs.some((subscription) => subscription.userId === user.id)) continue;
        const state = readState(user.id);
        if (!state?.reminder?.on) continue;
        const now = userNow(state.reminder.tz || 'UTC');
        if (!now || state.reminder.time !== now.hhmm) continue;
        if (user.lastReminder === now.date) continue;
        if ((state.workouts || []).some((workout) => workout.d === now.date)) continue;
        const routineId = effectiveRoutineId(state, now.date);
        if (!routineId) continue;
        const routine = (state.routines || []).find((candidate) => candidate.id === routineId);
        console.log('reminder firing', user.id, routineId);
        user.lastReminder = now.date;
        saveDatabase();
        void sendPush(user.id, {
          title: routine
            ? `${routine.emoji || '🏋️'} ${routine.name} today`
            : 'Workout planned today',
          body: "It's on your plan — let's go 💪",
          tag: 'day-reminder',
        });
      }
    }, 10_000).unref(),
  );
  intervals.push(
    setInterval(() => {
      for (const [id, challenge] of challenges) {
        if (challenge.exp < Date.now()) challenges.delete(id);
      }
    }, 60_000).unref(),
  );
  intervals.push(
    setInterval(() => {
      for (const [uid, currentPresence] of presence) {
        if (Date.now() - currentPresence.updatedAt > PRESENCE_TTL_MS) presence.delete(uid);
      }
    }, 30_000).unref(),
  );

  const requireAdmin = (
    cookieHeader: string | undefined,
  ): { user: User; response?: never } | { user?: never; response: Response } => {
    const user = readSession(cookieHeader);
    if (!user) return { response: json({ error: 'not signed in' }, 401) };
    if (!isAdmin(user)) return { response: json({ error: 'forbidden' }, 403) };
    return { user };
  };

  const app = new Hono({ strict: true });

  // The legacy method table did not treat HEAD as GET. Hono dispatches HEAD through its GET
  // router, so this all-method middleware checks the raw method before a GET route can handle it.
  app.use('*', async (context, next) => {
    if (context.req.method === 'HEAD') return json({ error: 'not found' }, 404);
    await next();
  });

  app.get('/api/health', () => json({ ok: true, users: database.users.length }));

  app.get('/api/config', () => json({ invite_only: config.inviteOnly }));

  app.get('/api/me', (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    return json({ user: { id: user.id, name: user.name, admin: isAdmin(user) } });
  });

  app.post('/api/register/options', async (context) => {
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return json({ error: 'name required' }, 400);
    const code = String(body.code || '').trim().toUpperCase();
    if (
      config.inviteOnly &&
      !database.invites.some(
        (invite) => invite.code === code && !invite.usedBy && !invite.revoked,
      )
    ) {
      return json({ error: 'a valid invite code is required' }, 403);
    }
    const uid = crypto.randomBytes(12).toString('base64url');
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      userID: Buffer.from(uid),
      userName: name,
      userDisplayName: name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      excludeCredentials: [],
    });
    const cid = putChallenge({ challenge: options.challenge, name, uid, code });
    return json({ cid, options });
  });

  app.post('/api/register/verify', async (context) => {
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const challenge = takeChallenge(typeof body.cid === 'string' ? body.cid : '');
    if (!challenge?.uid) return json({ error: 'challenge expired — try again' }, 400);

    const credential = body.credential as RegistrationCredential;
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpId,
        requireUserVerification: false,
      });
    } catch (error) {
      return json({ error: `verification failed: ${errorMessage(error)}` }, 400);
    }
    if (!verification.verified) return json({ error: 'not verified' }, 400);

    const registeredCredential = verification.registrationInfo.credential;
    if (database.creds.find((candidate) => candidate.id === registeredCredential.id)) {
      return json({ error: 'credential already registered' }, 409);
    }

    let invite: Invite | undefined;
    if (config.inviteOnly) {
      invite = database.invites.find(
        (candidate) =>
          candidate.code === challenge.code && !candidate.usedBy && !candidate.revoked,
      );
      if (!invite) {
        return json(
          { error: 'invite code is no longer valid — ask for a new one' },
          403,
        );
      }
    }

    const user: User = {
      id: challenge.uid,
      name: challenge.name as string,
      created: new Date().toISOString(),
    };
    if (invite) {
      user.invitedBy = invite.code;
      invite.usedBy = user.id;
      invite.usedAt = user.created;
    }
    database.users.push(user);
    database.creds.push({
      id: registeredCredential.id,
      userId: user.id,
      publicKey: Buffer.from(registeredCredential.publicKey).toString('base64url'),
      counter: registeredCredential.counter || 0,
      transports: credential?.response?.transports || [],
    });
    saveDatabase();
    return json(
      { user: { id: user.id, name: user.name, admin: isAdmin(user) } },
      200,
      { 'Set-Cookie': sessionCookie(user) },
    );
  });

  app.post('/api/login/options', async () => {
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      userVerification: 'preferred',
      allowCredentials: [],
    });
    const cid = putChallenge({ challenge: options.challenge });
    return json({ cid, options });
  });

  app.post('/api/login/verify', async (context) => {
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const challenge = takeChallenge(typeof body.cid === 'string' ? body.cid : '');
    if (!challenge) return json({ error: 'challenge expired — try again' }, 400);

    const credentialRecord = asRecord(body.credential);
    const credentialId = credentialRecord?.id;
    const storedCredential = database.creds.find(
      (candidate) => candidate.id === credentialId,
    );
    if (!storedCredential) {
      return json({ error: 'unknown passkey — create a profile first' }, 404);
    }

    const credential = body.credential as AuthenticationCredential;
    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpId,
        requireUserVerification: false,
        credential: {
          id: storedCredential.id,
          publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
          counter: storedCredential.counter,
          transports:
            storedCredential.transports as AuthenticationVerificationOptions['credential']['transports'],
        },
      });
    } catch (error) {
      return json({ error: `verification failed: ${errorMessage(error)}` }, 400);
    }
    if (!verification.verified) return json({ error: 'not verified' }, 400);

    storedCredential.counter = verification.authenticationInfo.newCounter;
    saveDatabase();
    const user = database.users.find((candidate) => candidate.id === storedCredential.userId);
    if (!user) return json({ error: 'user missing' }, 500);
    if (user.disabled) return json({ error: 'this account has been disabled' }, 403);
    return json(
      { user: { id: user.id, name: user.name, admin: isAdmin(user) } },
      200,
      { 'Set-Cookie': sessionCookie(user) },
    );
  });

  app.post('/api/logout', () =>
    json({ ok: true }, 200, {
      'Set-Cookie': clearCookie,
    }),
  );

  app.post('/api/logout/all', (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    user.sv = sessionVersion(user) + 1;
    saveDatabase();
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
  });

  app.get('/api/data', (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    try {
      const state = JSON.parse(fs.readFileSync(stateFile(user.id), 'utf8')) as unknown;
      return json({ state });
    } catch {
      return json({ state: null });
    }
  });

  app.put('/api/data', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const state = asRecord(body.state);
    if (!body.state || typeof body.state !== 'object' || !state) {
      return json({ error: 'state required' }, 400);
    }
    delete state.active;
    atomicWrite(stateFile(user.id), JSON.stringify(body.state));
    return json({ ok: true, ts: state._ts || null });
  });

  app.get('/api/push/public-key', () => json({ key: vapid.publicKey }));

  app.post('/api/push/subscribe', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const subscription = asRecord(body.subscription);
    const keys = asRecord(subscription?.keys);
    if (!subscription?.endpoint || !keys?.p256dh || !keys.auth) {
      return json({ error: 'invalid subscription' }, 400);
    }
    database.subs = database.subs.filter(
      (candidate) => candidate.endpoint !== subscription.endpoint,
    );
    database.subs.push({
      userId: user.id,
      endpoint: subscription.endpoint as string,
      keys: { p256dh: keys.p256dh as string, auth: keys.auth as string },
      created: new Date().toISOString(),
    });
    saveDatabase();
    return json({ ok: true });
  });

  app.post('/api/push/unsubscribe', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    database.subs = database.subs.filter(
      (subscription) =>
        !(subscription.userId === user.id && subscription.endpoint === body.endpoint),
    );
    saveDatabase();
    return json({ ok: true });
  });

  app.post('/api/push/test', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    await sendPush(user.id, {
      title: 'openGym',
      body: 'Test notification ✅ — this is what alerts look like.',
      tag: 'test',
    });
    return json({ ok: true });
  });

  app.post('/api/push/rest-timer', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const seconds = Math.max(
      1,
      Math.min(3600, Math.round(Number(body.seconds) || 0)),
    );
    if (!seconds) return json({ error: 'seconds required' }, 400);
    scheduleRestTimer(user.id, seconds);
    return json({ ok: true });
  });

  app.post('/api/push/rest-timer/cancel', (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    cancelRestTimer(user.id);
    return json({ ok: true });
  });

  app.post('/api/activity', async (context) => {
    const user = readSession(context.req.header('cookie'));
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    if (body.active) {
      presence.set(user.id, {
        name: String(body.name || '').slice(0, 60),
        exIdx: Number(body.exIdx) || 0,
        exTotal: Number(body.exTotal) || 0,
        setsDone: Number(body.setsDone) || 0,
        setsTotal: Number(body.setsTotal) || 0,
        startedAt: Number(body.startedAt) || Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      presence.delete(user.id);
    }
    return json({ ok: true });
  });

  app.get('/api/admin/users', (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const users = database.users.map((user) => {
      const state = readState(user.id) || {};
      const workouts = state.workouts || [];
      const lastWorkout = workouts[workouts.length - 1];
      return {
        id: user.id,
        name: user.name,
        created: user.created || null,
        disabled: Boolean(user.disabled),
        admin: isAdmin(user),
        invitedBy: user.invitedBy || null,
        workouts: workouts.length,
        lastWorkout: lastWorkout ? lastWorkout.d : null,
        lastSync: state._ts || null,
        hasPush: database.subs.some((subscription) => subscription.userId === user.id),
        live: livePresence(user.id),
      };
    });
    return json({ users, invite_only: config.inviteOnly, now: Date.now() });
  });

  app.get('/api/admin/user', (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const id = context.req.query('id');
    const user = database.users.find((candidate) => candidate.id === id);
    if (!user) return json({ error: 'no such user' }, 404);
    const state = readState(user.id) || {};
    return json({
      user: {
        id: user.id,
        name: user.name,
        created: user.created || null,
        disabled: Boolean(user.disabled),
        admin: isAdmin(user),
        invitedBy: user.invitedBy || null,
      },
      unit: state.unit || 'kg',
      lastSync: state._ts || null,
      routines: (state.routines || []).map((routine) => ({
        id: routine.id,
        name: routine.name,
        emoji: routine.emoji,
        count: (routine.ex || []).length,
      })),
      bodyweight: state.bodyweight || [],
      workouts: (state.workouts || []).slice().reverse(),
    });
  });

  app.post('/api/admin/user/disable', async (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const user = database.users.find((candidate) => candidate.id === body.id);
    if (!user) return json({ error: 'no such user' }, 404);
    if (isAdmin(user)) return json({ error: 'cannot disable an admin' }, 400);
    user.disabled = Boolean(body.disabled);
    if (user.disabled) presence.delete(user.id);
    saveDatabase();
    return json({ ok: true, id: user.id, disabled: user.disabled });
  });

  app.get('/api/admin/invites', (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const invites = database.invites.map((invite) => ({
      ...invite,
      usedByName: invite.usedBy
        ? database.users.find((user) => user.id === invite.usedBy)?.name || null
        : null,
    }));
    return json({ invites, invite_only: config.inviteOnly });
  });

  app.post('/api/admin/invites/new', async (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    let code: string;
    do {
      code = crypto.randomBytes(8).toString('hex').toUpperCase();
    } while (database.invites.some((invite) => invite.code === code));
    const invite: Invite = {
      code,
      note: String(body.note || '').slice(0, 60),
      createdBy: authorization.user.id,
      created: new Date().toISOString(),
    };
    database.invites.push(invite);
    saveDatabase();
    return json({ invite });
  });

  app.post('/api/admin/invites/revoke', async (context) => {
    const authorization = requireAdmin(context.req.header('cookie'));
    if (authorization.response) return authorization.response;
    const body = await readJsonBody(context.req.raw, config.maxBodyBytes);
    const invite = database.invites.find(
      (candidate) => candidate.code === String(body.code || '').toUpperCase(),
    );
    if (!invite) return json({ error: 'no such code' }, 404);
    if (invite.usedBy) return json({ error: 'already used — cannot revoke' }, 400);
    database.invites = database.invites.filter((candidate) => candidate.code !== invite.code);
    saveDatabase();
    return json({ ok: true });
  });

  app.notFound(() => json({ error: 'not found' }, 404));
  app.onError((error, context) => {
    const pathname = new URL(context.req.url).pathname;
    console.error(`${context.req.method} ${pathname}`, error);
    return json({ error: 'server error' }, 500);
  });

  const dispose = (): void => {
    for (const interval of intervals) clearInterval(interval);
    for (const timer of restTimers.values()) clearTimeout(timer);
    restTimers.clear();
    challenges.clear();
    presence.clear();
  };

  return { app, config, dispose };
}
