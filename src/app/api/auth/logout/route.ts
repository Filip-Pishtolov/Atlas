import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, sessionCookieName, sessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const jar = await cookies();
  const sid = jar.get(sessionCookieName)?.value;
  if (sid) destroySession(sid);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(sessionCookieName, '', { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
