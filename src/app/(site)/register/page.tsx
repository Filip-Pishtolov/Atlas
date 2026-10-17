import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create an Atlas account to keep your bookings, traveller details and balance reminders together.',
};

interface PageProps {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

function safeNext(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/account');

  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <div className="container-narrow section" style={{ maxWidth: '32rem' }}>
      <div className="card card-pad stack">
        <div>
          <span className="eyebrow-accent">Join Atlas</span>
          <h1 style={{ marginTop: 'var(--s2)' }}>Create your account</h1>
          <p className="muted" style={{ margin: 'var(--s3) 0 0' }}>
            It takes a minute and means you never have to retype passport details or
            hunt for a booking reference again.
          </p>
        </div>

        <AuthForm mode="register" next={next} />

        <hr className="divider" style={{ margin: 0 }} />

        <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
          Already booked with us?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in instead</Link>.
        </p>
      </div>

      <div className="stack stack-sm" style={{ marginTop: 'var(--s5)' }}>
        <p className="hint" style={{ margin: 0 }}>
          An account gets you a running list of your trips, the balance date for each
          one, and your traveller details saved for next time. We never sell your
          address on, and the monthly departures email is opt-in only.
        </p>
        <p className="hint" style={{ margin: 0 }}>
          Atlas is a fictional agency built for a university assignment — please do not
          enter a password you use anywhere real.
        </p>
      </div>
    </div>
  );
}
