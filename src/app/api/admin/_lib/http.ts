import { NextResponse } from 'next/server';
import type { SqlParam } from '@/lib/db';
import { parseEurosToCents } from '@/lib/money';

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(what: string): NextResponse {
  return jsonError(`${what} not found.`, 404);
}

export async function readBody(
  req: Request,
): Promise<Record<string, unknown> | null> {
  const type = req.headers.get('content-type') ?? '';

  try {
    if (type.includes('multipart/form-data') || type.includes('form-urlencoded')) {
      const form = await req.formData();
      const out: Record<string, unknown> = {};
      form.forEach((value, key) => {
        out[key] = typeof value === 'string' ? value : null;
      });
      return out;
    }

    const raw = (await req.text()).trim();
    if (raw === '') return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

export function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

export function optText(value: unknown): string | null {
  const s = text(value);
  return s === '' ? null : s;
}

export function int(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }
  const s = text(value);
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function intInRange(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const n = int(value);
  if (n === null || n < min || n > max) return null;
  return n;
}

export function flag(value: unknown): number {
  if (value === true) return 1;
  if (value === false || value === null || value === undefined) return 0;
  const s = text(value).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes' ? 1 : 0;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  const s = text(value).toLowerCase();
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

export function listOf(allowed: readonly string[]): string {
  const quoted = allowed.map((a) => `'${a}'`);
  if (quoted.length < 2) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
}

export function readMoney(
  body: Record<string, unknown>,
  centsKey: string,
): number | null | undefined {
  const euroKey = centsKey.replace(/_cents$/, '');

  if (has(body, centsKey)) {
    return int(body[centsKey]);
  }
  if (has(body, euroKey)) {
    const raw = body[euroKey];
    if (raw === null || raw === '') return null;
    return parseEurosToCents(typeof raw === 'number' ? raw : text(raw));
  }
  return undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function readDate(value: unknown): string | null {
  const s = text(value);
  if (!DATE_RE.test(s) || !isRealDate(s)) return null;
  return s;
}

export function readStamp(value: unknown, endOfDay = false): string | null {
  const s = text(value);
  if (DATE_RE.test(s)) {
    if (!isRealDate(s)) return null;
    return `${s} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }
  const m = STAMP_RE.exec(s);
  if (!m) return null;
  if (!isRealDate(s.slice(0, 10))) return null;
  const normalised = s.replace('T', ' ');
  return m[1] ? normalised : `${normalised}:00`;
}

export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

export function fail<T>(error: string): Parsed<T> {
  return { ok: false, error };
}

export function readArray(value: unknown): unknown[] | null {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : null;
}

export class UpdateSet {
  private readonly assignments: string[] = [];
  private readonly values: SqlParam[] = [];

  add(column: string, value: SqlParam): this {
    this.assignments.push(`${column} = ?`);
    this.values.push(value);
    return this;
  }

  addRaw(assignment: string): this {
    this.assignments.push(assignment);
    return this;
  }

  get isEmpty(): boolean {
    return this.values.length === 0;
  }

  get clause(): string {
    return this.assignments.join(', ');
  }

  get params(): SqlParam[] {
    return this.values;
  }

  get columns(): string[] {
    return this.assignments
      .filter((a) => a.includes(' = ?'))
      .map((a) => a.slice(0, a.indexOf(' = ?')));
  }
}

export function readRouteId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function readPaging(
  url: URL,
  defaultLimit = 100,
): { limit: number; offset: number } {
  const limit = intInRange(url.searchParams.get('limit'), 1, 500) ?? defaultLimit;
  const offset = Math.max(0, int(url.searchParams.get('offset')) ?? 0);
  return { limit, offset };
}
