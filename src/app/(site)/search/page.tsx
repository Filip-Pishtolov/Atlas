import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import TourCard from '@/components/TourCard';
import { query } from '@/lib/db';
import { listDestinations, listTours, liveAutomaticPromotions } from '@/lib/queries';
import type { BlogPost, Destination } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Atlas trips, destinations and Journal pieces.',
  robots: { index: false, follow: true },
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = firstParam(params.q).trim();
  const hasQuery = q.length > 0;

  const tours = hasQuery ? listTours({ search: q }) : [];
  const promotions = tours.length > 0 ? liveAutomaticPromotions() : [];

  const destinations = hasQuery
    ? query<Destination>(
        `SELECT * FROM destinations
          WHERE name LIKE ? OR country LIKE ? OR region LIKE ? OR summary LIKE ?
          ORDER BY is_featured DESC, name`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
      )
    : [];

  const posts = hasQuery
    ? query<BlogPost>(
        `SELECT * FROM blog_posts
          WHERE status = 'published' AND (title LIKE ? OR excerpt LIKE ?)
          ORDER BY published_at DESC`,
        `%${q}%`,
        `%${q}%`,
      )
    : [];

  const total = tours.length + destinations.length + posts.length;
  const suggestions = listDestinations(true).slice(0, 6);
  const fallbackSuggestions =
    suggestions.length > 0 ? suggestions : listDestinations().slice(0, 6);

  return (
    <>
      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Search' }]} />
          <span className="eyebrow eyebrow-accent">Search</span>
          <h1>{hasQuery ? `Results for “${q}”` : 'Search Atlas'}</h1>

          <form action="/search" method="get" role="search" style={{ marginTop: 'var(--s5)' }}>
            <label className="label" htmlFor="site-search">
              Trips, destinations and Journal pieces
            </label>
            <div className="cluster cluster-sm" style={{ marginTop: 'var(--s2)' }}>
              <input
                id="site-search"
                className="input"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Morocco, ridge walking, best time to visit…"
                style={{ flex: '1 1 260px' }}
              />
              <button className="btn btn-primary" type="submit">
                Search
              </button>
            </div>
            <span className="hint" style={{ display: 'block', marginTop: 'var(--s2)' }}>
              We match trip titles and summaries, destination names and countries,
              and Journal headlines.
            </span>
          </form>

          {hasQuery && (
            <p className="muted" style={{ marginTop: 'var(--s5)', marginBottom: 0 }}>
              {total === 0
                ? 'Nothing matched.'
                : `${total} ${total === 1 ? 'result' : 'results'} — ${tours.length} ${
                    tours.length === 1 ? 'trip' : 'trips'
                  }, ${destinations.length} ${
                    destinations.length === 1 ? 'destination' : 'destinations'
                  }, ${posts.length} ${posts.length === 1 ? 'article' : 'articles'}.`}
            </p>
          )}
        </div>
      </section>

      {!hasQuery && (
        <section className="section-tight">
          <div className="container">
            <div className="section-head section-head-line">
              <div>
                <span className="eyebrow">Start here</span>
                <h2>Where people usually begin</h2>
              </div>
            </div>
            {fallbackSuggestions.length === 0 ? (
              <div className="card empty-state">
                <p style={{ margin: 0 }}>
                  Our catalogue is not loaded yet, so there is nothing to search.
                </p>
              </div>
            ) : (
              <div className="tag-list">
                {fallbackSuggestions.map((dest) => (
                  <Link key={dest.id} className="chip" href={`/destinations/${dest.slug}`}>
                    {dest.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {hasQuery && total === 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="card empty-state">
              <p style={{ marginBottom: 'var(--s2)' }}>
                Nothing on the site matches <strong>“{q}”</strong>.
              </p>
              <p style={{ marginBottom: 'var(--s5)' }}>
                We run trips in nine countries, so it may simply be somewhere we
                do not go yet. Try one of these instead:
              </p>
              <div className="tag-list" style={{ justifyContent: 'center' }}>
                {fallbackSuggestions.map((dest) => (
                  <Link key={dest.id} className="chip" href={`/destinations/${dest.slug}`}>
                    {dest.name}
                  </Link>
                ))}
                <Link className="chip" href="/tours">
                  All trips
                </Link>
                <Link className="chip" href="/contact">
                  Ask us directly
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {hasQuery && tours.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="section-head section-head-line">
              <div>
                <span className="eyebrow">Trips</span>
                <h2>
                  {tours.length} {tours.length === 1 ? 'trip' : 'trips'}
                </h2>
              </div>
              <Link className="btn btn-ghost btn-sm" href="/tours">
                Browse everything
              </Link>
            </div>
            <div className="grid grid-3">
              {tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} promotions={promotions} />
              ))}
            </div>
          </div>
        </section>
      )}

      {hasQuery && destinations.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="section-head section-head-line">
              <div>
                <span className="eyebrow">Destinations</span>
                <h2>
                  {destinations.length}{' '}
                  {destinations.length === 1 ? 'destination' : 'destinations'}
                </h2>
              </div>
            </div>
            <div className="grid grid-3">
              {destinations.map((dest) => (
                <article key={dest.id} className="card card-link">
                  <Link
                    href={`/destinations/${dest.slug}`}
                    style={{ display: 'contents', color: 'inherit' }}
                  >
                    <div className="card-media">
                      <img
                        src={dest.hero_image}
                        alt={`${dest.name}, ${dest.country}`}
                        loading="lazy"
                        decoding="async"
                        width={600}
                        height={400}
                      />
                    </div>
                    <div className="card-body">
                      <span className="eyebrow" style={{ margin: 0 }}>
                        {dest.country}
                        {dest.region ? ` · ${dest.region}` : ''}
                      </span>
                      <h3 className="card-title">{dest.name}</h3>
                      <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                        {dest.summary}
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasQuery && posts.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="section-head section-head-line">
              <div>
                <span className="eyebrow">The Journal</span>
                <h2>
                  {posts.length} {posts.length === 1 ? 'article' : 'articles'}
                </h2>
              </div>
              <Link className="btn btn-ghost btn-sm" href="/blog">
                All pieces
              </Link>
            </div>
            <div className="stack">
              {posts.map((post) => (
                <article key={post.id} className="card card-pad between">
                  <div style={{ maxWidth: '60ch' }}>
                    <span className="eyebrow" style={{ margin: 0 }}>
                      {post.author_name}
                    </span>
                    <h3
                      className="card-title"
                      style={{ marginTop: '4px', marginBottom: 'var(--s2)' }}
                    >
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                      {post.excerpt}
                    </p>
                  </div>
                  <Link className="btn btn-secondary btn-sm" href={`/blog/${post.slug}`}>
                    Read
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
