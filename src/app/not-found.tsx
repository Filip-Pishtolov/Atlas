import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { listDestinations } from '@/lib/queries';
import type { Destination } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'That page is not on the Atlas map. Search the catalogue or jump straight to one of our destinations.',
};

export default function NotFound() {
  let destinations: Destination[] = [];
  if (existsSync(path.join(process.cwd(), 'data', 'atlas.db'))) {
    try {
      const featured = listDestinations(true);
      destinations = (featured.length ? featured : listDestinations()).slice(0, 6);
    } catch {
      destinations = [];
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="container site-header-inner">
          <Link href="/" className="brand">
            Atlas
            <span className="brand-mark">est. 2019</span>
          </Link>
          <Link className="btn btn-secondary btn-sm" href="/tours">
            Browse tours
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="section">
          <div className="container-narrow">
            <span className="eyebrow eyebrow-accent">Error 404 · unsurveyed</span>
            <h1 style={{ maxWidth: '18ch' }}>This page is not on our map</h1>

            <p className="lead" style={{ marginTop: 'var(--s5)' }}>
              Sorry — the address you followed does not exist any more, or it
              never did. Tours get retired at the end of a season and their pages
              come down with them, so an old link or a stale search result will
              land you here.
            </p>

            <form
              action="/search"
              method="get"
              className="field"
              style={{ marginTop: 'var(--s6)' }}
            >
              <label className="label" htmlFor="notfound-search">
                Search the catalogue
              </label>
              <div className="cluster cluster-sm">
                <input
                  id="notfound-search"
                  className="input"
                  type="search"
                  name="q"
                  placeholder="Morocco, hiking, seven days…"
                  style={{ flex: '1 1 240px' }}
                />
                <button className="btn btn-primary" type="submit">
                  Search
                </button>
                <Link className="btn btn-secondary" href="/tours">
                  See every departure
                </Link>
              </div>
            </form>

            {destinations.length > 0 && (
              <>
                <hr />
                <span className="eyebrow">Start from a destination</span>
                <div className="tag-list">
                  {destinations.map((d) => (
                    <Link
                      key={d.id}
                      className="chip"
                      href={`/destinations/${d.slug}`}
                    >
                      {d.name}
                      <span className="muted" aria-hidden="true">
                        {d.country}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <hr />

            <p className="muted">
              Still stuck? Send us the link you followed and we will point you at
              the right page — or tell you what replaced it.{' '}
              <Link href="/contact">Contact the Skopje office</Link>.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
