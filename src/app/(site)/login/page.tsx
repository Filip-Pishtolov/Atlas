import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to your Atlas account to see your bookings, traveller details and balance dates.',
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

const DEMO_ACCOUNTS = [
  { email: 'admin@atlas.travel', role: 'Administrator — full admin panel' },
  { email: 'sara@atlas.travel', role: 'Staff — bookings, enquiries, reviews' },
  { email: 'maria@example.com', role: 'Customer — has existing bookings' },
];

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/account');

  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <div className="container-narrow section" style={{ maxWidth: '32rem' }}>
      <div className="card card-pad stack">
        <div>
          <span className="eyebrow-accent">Welcome back</span>
          <h1 style={{ marginTop: 'var(--s2)' }}>Sign in to Atlas</h1>
          <p className="muted" style={{ margin: 'var(--s3) 0 0' }}>
            Your bookings, traveller details and balance dates, all in one place.
          </p>
        </div>

        <AuthForm mode="login" next={next} />

        <hr className="divider" style={{ margin: 0 }} />

        <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
          No account yet?{' '}
          <Link href={`/register?next=${encodeURIComponent(next)}`}>
            Create one in under a minute
          </Link>
          .
        </p>
      </div>

      <div className="alert alert-info stack stack-sm" style={{ marginTop: 'var(--s5)' }}>
        <strong>Demonstration accounts</strong>
        <p style={{ margin: 0 }}>
          Atlas is a university project seeded with sample data. Any of these will sign
          you straight in — the password for all three is{' '}
          <span className="mono">atlas123</span>.
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} style={{ marginTop: 'var(--s1)' }}>
              <span className="mono">{a.email}</span> — {a.role}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
