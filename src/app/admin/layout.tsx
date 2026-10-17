import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav, { AdminSignOut } from '@/components/admin/AdminNav';
import { getCurrentUser, isStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Operations',
    template: '%s · Atlas operations',
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) redirect('/login?next=/admin');

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/admin" className="brand">
          Atlas
          <span className="brand-mark">operations</span>
        </Link>

        <AdminNav />

        <div className="stack stack-sm" style={{ marginTop: 'auto' }}>
          <hr className="divider" style={{ margin: 0 }} />
          <div className="stack stack-sm" style={{ gap: 'var(--s1)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              {user.name}
            </span>
            <span className="mono muted" style={{ fontSize: '0.7rem' }}>
              {user.role === 'admin' ? 'Administrator' : 'Staff'} ·{' '}
              {user.email}
            </span>
          </div>
          <Link href="/" className="btn btn-secondary btn-sm btn-block">
            View site
          </Link>
          <AdminSignOut />
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
