import crypto from 'node:crypto';
import path from 'node:path';

import { passkey } from '@better-auth/passkey';
import { betterAuth, APIError } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { admin } from 'better-auth/plugins';
import Database from 'better-sqlite3';

type BetterSqliteDatabase = Database.Database;
type BaseAuth = ReturnType<typeof betterAuth>;

interface AuthApiExtension {
  banUser(options: { body: { userId: string; banReason?: string }; headers: Headers }): Promise<unknown>;
  unbanUser(options: { body: { userId: string }; headers: Headers }): Promise<unknown>;
}

type AuthInstance = Omit<BaseAuth, 'api'> & {
  api: BaseAuth['api'] & AuthApiExtension;
};

interface AuthSession {
  user: {
    id: string;
    name: string;
    banned?: boolean | null;
  };
  session: unknown;
}

export interface LegacyAuthUser {
  id: string;
  name: string;
  created?: string;
  admin?: boolean;
  disabled?: boolean;
}

export interface LegacyAuthCredential {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
}

export interface AuthRegistration {
  id: string;
  name: string;
  code: string;
  created: string;
}

export interface AuthCallbacks {
  isAdmin: (userId: string) => boolean;
  isInviteValid: (code: string) => boolean;
  registerUser: (registration: AuthRegistration) => void;
}

export interface AuthRuntimeOptions {
  dataDir: string;
  origin: string;
  rpId: string;
  rpName: string;
  sessionDays: number;
  secret: string;
  legacyUsers: LegacyAuthUser[];
  legacyCredentials: LegacyAuthCredential[];
  callbacks: AuthCallbacks;
}

const MIGRATION_KEY = 'opengym-legacy-json-v1';
const REGISTRATION_CONTEXT_TTL_MS = 5 * 60_000;

function authEmail(userId: string): string {
  const localPart = userId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 90) || 'user';
  return `${localPart}@users.opengym.local`;
}

function decodeLegacyPublicKey(value: string): string {
  // Better Auth stores passkey public keys as padded standard base64. The old
  // server used unpadded base64url, which is accepted by Buffer but should be
  // normalized during the one-time import.
  return Buffer.from(value, 'base64url').toString('base64');
}

function migrationValue(database: Database.Database): string | null {
  database.exec(
    'CREATE TABLE IF NOT EXISTS "opengym_meta" ("key" TEXT PRIMARY KEY NOT NULL, "value" TEXT NOT NULL)',
  );
  const row = database
    .prepare('SELECT "value" FROM "opengym_meta" WHERE "key" = ?')
    .get(MIGRATION_KEY) as { value?: string } | undefined;
  return row?.value || null;
}

/**
 * Creates the Better Auth instance and imports the legacy JSON identity data.
 * Workout state, subscriptions, and invites intentionally remain in db.json;
 * this module owns users, sessions, passkeys, and credential accounts.
 */
export interface AuthRuntime {
  auth: AuthInstance;
  database: BetterSqliteDatabase;
  createRegistrationContext(name: string, code: string): string;
  getRegistrationContext(token: string | null | undefined): AuthRegistration | null;
  validateRegistrationContext(token: string | null | undefined, name: string): AuthRegistration | null;
  consumeRegistrationContext(token: string | null | undefined): AuthRegistration | null;
  registerEmailUser(user: { id: string; name: string; createdAt?: string | Date }, code: string): void;
  deleteUser(userId: string): Promise<void>;
  getSession(headers: Headers): Promise<AuthSession | null>;
  dispose(): void;
}

export async function createAuthRuntime(options: AuthRuntimeOptions): Promise<AuthRuntime> {
  const database = new Database(path.join(options.dataDir, 'auth.db'));
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');

  const registrationContexts = new Map<string, AuthRegistration>();
  const signContext = (registration: AuthRegistration): string => {
    const payload = Buffer.from(JSON.stringify(registration)).toString('base64url');
    const mac = crypto.createHmac('sha256', options.secret).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  };
  const readContext = (token: string | null | undefined): AuthRegistration | null => {
    if (!token) return null;
    const separator = token.lastIndexOf('.');
    if (separator < 0) return null;
    const payload = token.slice(0, separator);
    const mac = token.slice(separator + 1);
    const expected = crypto.createHmac('sha256', options.secret).update(payload).digest('base64url');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
      const registration = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthRegistration;
      if (!registration.id || !registration.name || !registration.created) return null;
      const createdAt = Date.parse(registration.created);
      if (Number.isNaN(createdAt) || createdAt + REGISTRATION_CONTEXT_TTL_MS < Date.now()) return null;
      if (!registrationContexts.has(registration.id)) return null;
      return registration;
    } catch {
      return null;
    }
  };

  const auth = betterAuth({
    database,
    secret: options.secret,
    baseURL: options.origin,
    trustedOrigins: [options.origin],
    session: {
      expiresIn: options.sessionDays * 86_400,
      updateAge: 24 * 60 * 60,
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
      }),
      passkey({
        rpID: options.rpId,
        rpName: options.rpName,
        origin: options.origin,
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
        registration: {
          requireSession: false,
          resolveUser: async ({ context }) => {
            const registration = readContext(context);
            if (!registration) {
              throw APIError.from('BAD_REQUEST', {
                code: 'REGISTRATION_CONTEXT_EXPIRED',
                message: 'registration context expired — try again',
              });
            }
            return {
              id: registration.id,
              name: registration.name,
              displayName: registration.name,
            };
          },
          afterVerification: async ({ user, context, ctx }) => {
            const registration = readContext(context);
            if (!registration) {
              if (ctx.context.session?.user.id) {
                // Keep Better Auth's normal "add a passkey" flow available to
                // an already signed-in profile. New-profile ceremonies always
                // carry our signed context and are handled below.
                return { userId: ctx.context.session.user.id };
              }
              throw APIError.from('BAD_REQUEST', {
                code: 'REGISTRATION_CONTEXT_EXPIRED',
                message: 'registration context expired — try again',
              });
            }
            if (!options.callbacks.isInviteValid(registration.code)) {
              throw APIError.from('FORBIDDEN', {
                code: 'INVITE_INVALID',
                message: 'a valid invite code is required',
              });
            }

            const existing = await ctx.context.internalAdapter.findUserById(registration.id);
            if (!existing) {
              await ctx.context.internalAdapter.createUser(
                {
                  id: registration.id,
                  name: user.name,
                  email: authEmail(registration.id),
                  emailVerified: true,
                  ...(options.callbacks.isAdmin(registration.id) ? { role: 'admin' } : {}),
                },
                { method: 'passkey' },
              );
            }
            options.callbacks.registerUser(registration);
            registrationContexts.delete(registration.id);
            return { userId: registration.id, name: registration.name };
          },
        },
      }),
    ],
  });

  const migrations = await getMigrations(auth.options);
  if (migrations.toBeCreated.length || migrations.toBeAdded.length) {
    await migrations.runMigrations();
  }

  // Keep configured administrators authoritative even after a fresh database
  // is created. Better Auth's admin plugin then revokes sessions on bans.
  const authContext = await auth.$context;
  for (const user of options.legacyUsers) {
    const existing = await authContext.internalAdapter.findUserById(user.id);
    if (!existing) {
      await authContext.internalAdapter.createUser(
        {
          id: user.id,
          name: user.name,
          email: authEmail(user.id),
          emailVerified: true,
          role: user.admin || options.callbacks.isAdmin(user.id) ? 'admin' : 'user',
          ...(user.disabled ? { banned: true, banReason: 'account disabled' } : {}),
        },
        { method: 'migration' },
      );
    } else {
      const updates: Record<string, unknown> = {
        role: user.admin || options.callbacks.isAdmin(user.id) ? 'admin' : 'user',
      };
      if (user.disabled) {
        updates.banned = true;
        updates.banReason = 'account disabled';
      } else if ((existing as { banReason?: string | null }).banReason === 'account disabled') {
        // The app's disable toggle is persisted in db.json. Only clear a ban
        // that this app created; preserve bans made through Better Auth's own
        // admin API so they remain authoritative across restarts.
        updates.banned = false;
        updates.banReason = null;
      }
      await authContext.internalAdapter.updateUser(user.id, updates);
    }
  }

  const legacyMigration = migrationValue(database);
  if (!legacyMigration) {
    for (const credential of options.legacyCredentials) {
      const existing = await authContext.adapter.findOne({
        model: 'passkey',
        where: [{ field: 'credentialID', value: credential.id }],
      });
      if (!existing) {
        await authContext.adapter.create({
          model: 'passkey',
          forceAllowId: true,
          data: {
            id: credential.id,
            name: 'Migrated passkey',
            userId: credential.userId,
            credentialID: credential.id,
            publicKey: decodeLegacyPublicKey(credential.publicKey),
            counter: credential.counter || 0,
            deviceType: credential.transports.includes('hybrid') ? 'multiDevice' : 'singleDevice',
            backedUp: false,
            transports: credential.transports.join(','),
            createdAt: new Date(),
            aaguid: null,
          },
        });
      }
    }
    database
      .prepare('INSERT OR REPLACE INTO "opengym_meta" ("key", "value") VALUES (?, ?)')
      .run(MIGRATION_KEY, new Date().toISOString());
  }

  return {
    auth: auth as unknown as AuthInstance,
    database,
    createRegistrationContext(name: string, code: string): string {
      const now = Date.now();
      for (const [id, registration] of registrationContexts) {
        if (Date.parse(registration.created) + REGISTRATION_CONTEXT_TTL_MS < now) {
          registrationContexts.delete(id);
        }
      }
      const registration: AuthRegistration = {
        id: crypto.randomBytes(12).toString('base64url'),
        name,
        code,
        created: new Date().toISOString(),
      };
      registrationContexts.set(registration.id, registration);
      return signContext(registration);
    },
    getRegistrationContext(token: string | null | undefined): AuthRegistration | null {
      return readContext(token);
    },
    validateRegistrationContext(
      token: string | null | undefined,
      name: string,
    ): AuthRegistration | null {
      const registration = readContext(token);
      if (!registration || registration.name !== name) return null;
      return options.callbacks.isInviteValid(registration.code) ? registration : null;
    },
    consumeRegistrationContext(token: string | null | undefined): AuthRegistration | null {
      const registration = readContext(token);
      if (registration) registrationContexts.delete(registration.id);
      return registration;
    },
    registerEmailUser(user, code): void {
      const created = user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : user.createdAt || new Date().toISOString();
      options.callbacks.registerUser({ id: user.id, name: user.name, code, created });
    },
    async deleteUser(userId: string): Promise<void> {
      const context = await auth.$context;
      await context.internalAdapter.deleteUser(userId);
    },
    async getSession(headers: Headers): Promise<AuthSession | null> {
      return auth.api.getSession({ headers, query: { disableCookieCache: true } });
    },
    dispose(): void {
      registrationContexts.clear();
      database.close();
    },
  };
}
