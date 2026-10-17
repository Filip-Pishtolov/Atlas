import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { listBlogPosts } from '@/lib/queries';
import type { BlogPost } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Journal',
  description:
    'Field notes from the Atlas guides and office: when to go where, what a walking day actually involves, and the practical detail that never fits on a tour page.',
};

function postDate(post: BlogPost): string {
  const raw = post.published_at ?? post.created_at;
  return new Date(`${raw.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function readingMinutes(post: BlogPost): number {
  const words = post.body.trim().split(/\s+/).length;
  return Math.max(2, Math.round(words / 210));
}

export default async function BlogIndexPage() {
  const posts = listBlogPosts(50);
  const [lead, ...rest] = posts;

  return (
    <>
      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'The Journal' }]} />
          <span className="eyebrow eyebrow-accent">The Journal</span>
          <h1>Notes from the road, written by the people leading it</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            No listicles and no sponsored hotel reviews. These are the answers our
            guides give over dinner on the second night — which month is really
            best, what the walking is like underfoot, and what to do about the bit
            of the trip nobody warns you about.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="section">
          <div className="container">
            <div className="card empty-state">
              <p style={{ marginBottom: 'var(--s4)' }}>
                The Journal is between issues. Our guides write in the weeks
                between departures, so new pieces land in clusters rather than on
                a schedule.
              </p>
              <Link className="btn btn-secondary" href="/tours">
                Browse our trips instead
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          {lead && (
            <section className="section-tight">
              <div className="container">
                <article className="card card-link">
                  <Link
                    href={`/blog/${lead.slug}`}
                    style={{ display: 'contents', color: 'inherit' }}
                  >
                    <div className="grid grid-2" style={{ gap: 0 }}>
                      <div className="card-media" style={{ aspectRatio: '3 / 2', height: '100%' }}>
                        <span className="badge badge-accent badge-float">Latest</span>
                        <img
                          src={lead.hero_image}
                          alt={lead.title}
                          loading="lazy"
                          decoding="async"
                          width={900}
                          height={600}
                        />
                      </div>
                      <div className="card-body" style={{ padding: 'var(--s6)', gap: 'var(--s3)' }}>
                        <span className="eyebrow" style={{ margin: 0 }}>
                          {postDate(lead)} · {readingMinutes(lead)} min read
                        </span>
                        <h2 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.2rem)' }}>
                          {lead.title}
                        </h2>
                        <p className="muted" style={{ margin: 0 }}>
                          {lead.excerpt}
                        </p>
                        <div className="card-foot">
                          <span className="muted" style={{ fontSize: '0.86rem' }}>
                            By {lead.author_name}
                          </span>
                          <span className="btn btn-secondary btn-sm">Read the piece</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="section-tight">
              <div className="container">
                <div className="section-head section-head-line">
                  <div>
                    <span className="eyebrow">Archive</span>
                    <h2>More from the Journal</h2>
                  </div>
                  <span className="muted" style={{ fontSize: '0.9rem' }}>
                    {posts.length} {posts.length === 1 ? 'piece' : 'pieces'} published
                  </span>
                </div>

                <div className="grid grid-3">
                  {rest.map((post) => (
                    <article key={post.id} className="card card-link">
                      <Link
                        href={`/blog/${post.slug}`}
                        style={{ display: 'contents', color: 'inherit' }}
                      >
                        <div className="card-media">
                          <img
                            src={post.hero_image}
                            alt={post.title}
                            loading="lazy"
                            decoding="async"
                            width={600}
                            height={400}
                          />
                        </div>
                        <div className="card-body">
                          <span className="eyebrow" style={{ margin: 0 }}>
                            {postDate(post)} · {readingMinutes(post)} min
                          </span>
                          <h3 className="card-title">{post.title}</h3>
                          <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                            {post.excerpt}
                          </p>
                          <div className="card-foot">
                            <span className="muted" style={{ fontSize: '0.84rem' }}>
                              {post.author_name}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
