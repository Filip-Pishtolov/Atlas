import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { get, run } from './db';
import type { PublicUser, Role, User } from './types';

const SESSION_COOKIE = 'atlas_session';
const SESSION_DAYS = 7;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function stripPassword(user: User): PublicUser {
  const { password_hash: _ignored, ...rest } = user;
  return rest;
}

function expiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function createSession(userId: number): string {
  const id = randomBytes(32).toString('hex');
  run(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    id,
    userId,
    expiryDate(),
  );
  return id;
}

export function destroySession(id: string): void {
  run('DELETE FROM sessions WHERE id = ?', id);
}

export const sessionCookieName = SESSION_COOKIE;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
  secure: process.env.NODE_ENV === 'production',
};

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const row = get<User & { expires_at: string }>(
    `SELECT u.*, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    id,
  );
  if (!row) return null;

  if (new Date(row.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    destroySession(id);
    return null;
  }
  return stripPassword(row);
}

export function isStaff(user: PublicUser | null): boolean {
  return user?.role === 'staff' || user?.role === 'admin';
}

export async function requireRole(
  ...roles: Role[]
): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

export function audit(
  user: PublicUser | null,
  action: string,
  entity: string,
  entityId: number | null,
  detail?: string,
): void {
  run(
    `INSERT INTO audit_log (user_id, actor_name, action, entity, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    user?.id ?? null,
    user?.name ?? 'system',
    action,
    entity,
    entityId,
    detail ?? null,
  );
}
