import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import HeaderNav from './HeaderNav';

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand">
          Atlas
          <span className="brand-mark">est. 2019</span>
        </Link>
        <HeaderNav user={user} />
      </div>
    </header>
  );
}
