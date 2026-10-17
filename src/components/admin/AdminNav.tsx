'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavGroup {
  heading: string;
  links: { href: string; label: string; note?: string }[];
}

const GROUPS: NavGroup[] = [
  {
    heading: 'Catalogue',
    links: [
      { href: '/admin/tours', label: 'Tours' },
      { href: '/admin/departures', label: 'Departures' },
      { href: '/admin/destinations', label: 'Destinations' },
    ],
  },
  {
    heading: 'Commerce',
    links: [
      { href: '/admin/promotions', label: 'Promotions' },
      { href: '/admin/bookings', label: 'Bookings' },
    ],
  },
  {
    heading: 'Inbox',
    links: [
      { href: '/admin/enquiries', label: 'Enquiries' },
      { href: '/admin/reviews', label: 'Reviews' },
    ],
  },
  {
    heading: 'Content',
    links: [{ href: '/admin/blog', label: 'Journal' }],
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <Link href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined}>
        Dashboard
      </Link>

      {GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="admin-nav-group">{group.heading}</p>
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      router.push('/');
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-block"
      onClick={signOut}
      disabled={busy}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
