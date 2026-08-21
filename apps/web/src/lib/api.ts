import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';

// Backend JSON API plus Better Auth's browser passkey client.
export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
export const IS_ANDROID = /Android/.test(navigator.userAgent);
export const BIO = IS_APPLE
  ? 'Face ID / Touch ID'
  : IS_ANDROID
    ? 'fingerprint or face unlock'
    : 'your fingerprint, face or PIN';
export const VAULT = IS_APPLE
  ? 'iCloud Keychain'
  : IS_ANDROID
    ? 'Google Password Manager'
    : 'your password manager';
export const webauthnOK = () => !!(window.PublicKeyCredential && navigator.credentials);

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const r = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data
      ? String(data.error)
      : `HTTP ${r.status}`;
    throw Object.assign(new Error(message), { status: r.status });
  }
  return data as T;
}

const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost:8080' : window.location.origin,
  plugins: [passkeyClient()],
});

interface AppUser {
  id: string;
  name: string;
  admin: boolean;
}

export async function passkeyRegister(name: string, code = ''): Promise<AppUser> {
  const registration = await api<{ context: string }>('/api/register/context', {
    method: 'POST',
    body: JSON.stringify({ name, code: code || '' }),
  });
  const result = await authClient.passkey.addPasskey({
    name,
    context: registration.context,
    createSession: true,
  });
  if (result.error || !result.data?.user) {
    throw Object.assign(new Error(result.error?.message || 'passkey registration failed'), {
      status: result.error?.status,
    });
  }
  return (await api<{ user: AppUser }>('/api/me')).user;
}

export async function passkeyLogin(): Promise<AppUser> {
  const result = await authClient.signIn.passkey();
  if (result.error || !result.data?.user) {
    throw Object.assign(new Error(result.error?.message || 'passkey sign-in failed'), {
      status: result.error?.status,
    });
  }
  return (await api<{ user: AppUser }>('/api/me')).user;
}

export async function emailRegister(
  name: string,
  email: string,
  password: string,
  code = '',
): Promise<AppUser> {
  // The context cookie binds the Better Auth account to the app profile and
  // lets the API enforce invite-only registration before creating the account.
  await api<{ context: string }>('/api/register/context', {
    method: 'POST',
    body: JSON.stringify({ name, code: code || '' }),
  });
  const result = await authClient.signUp.email({ name, email, password });
  if (result.error || !result.data?.user) {
    throw Object.assign(new Error(result.error?.message || 'email registration failed'), {
      status: result.error?.status,
    });
  }
  return (await api<{ user: AppUser }>('/api/me')).user;
}

export async function emailLogin(email: string, password: string): Promise<AppUser> {
  const result = await authClient.signIn.email({ email, password });
  if (result.error || !result.data?.user) {
    throw Object.assign(new Error(result.error?.message || 'email sign-in failed'), {
      status: result.error?.status,
    });
  }
  return (await api<{ user: AppUser }>('/api/me')).user;
}
