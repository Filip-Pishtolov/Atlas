'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicUser } from '@/lib/types';

const LINKS = [
  { href: '/tours', label: 'Tours' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/deals', label: 'Deals' },
  { href: '/blog', label: 'Journal' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function HeaderNav({ user }: { user: PublicUser | null }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setOpen(false);
      router.push('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">Menu</span>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>

      <nav id="site-nav" className={open ? 'nav open' : 'nav'}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}

        {user ? (
          <>
            <Link href="/account" onClick={() => setOpen(false)}>
              My trips
            </Link>
            {(user.role === 'admin' || user.role === 'staff') && (
              <Link
                href="/admin"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            )}
            <span className="header-user">
              <span className="muted">{user.name.split(' ')[0]}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </span>
          </>
        ) : (
          <Link
            href="/login"
            className="btn btn-secondary btn-sm"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
        )}
      </nav>
    </>
  );
}
