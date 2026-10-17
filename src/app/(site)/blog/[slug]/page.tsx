import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { query } from '@/lib/db';
import { getBlogPostBySlug } from '@/lib/queries';
import type { BlogPost } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function published(post: BlogPost | undefined): BlogPost | null {
  if (!post || post.status !== 'published') return null;
  return post;
}

function longDate(raw: string): string {
  return new Date(`${raw.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function readingMinutes(body: string): number {
  return Math.max(2, Math.round(body.trim().split(/\s+/).length / 210));
}

function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      if (block.startsWith('## ')) {
        return <h2 key={index}>{block.slice(3).trim()}</h2>;
      }
      if (block.startsWith('### ')) {
        return <h3 key={index}>{block.slice(4).trim()}</h3>;
      }
      const lines = block.split('\n').map((l) => l.trim());
      if (lines.length > 1 && lines.every((l) => l.startsWith('- '))) {
        return (
          <ul key={index}>
            {lines.map((line, i) => (
              <li key={i}>{line.slice(2)}</li>
            ))}
          </ul>
        );
      }
      if (block.startsWith('> ')) {
        return (
          <blockquote key={index}>
            {block
              .split('\n')
              .map((l) => l.replace(/^>\s?/, ''))
              .join(' ')}
          </blockquote>
        );
      }
      return <p key={index}>{block}</p>;
    });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = published(getBlogPostBySlug(slug));

  if (!post) {
    return {
      title: 'Article not found',
      description: 'This Journal piece is no longer published.',
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      images: [{ url: post.hero_image }],
      publishedTime: post.published_at ?? post.created_at,
      authors: [post.author_name],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = published(getBlogPostBySlug(slug));
  if (!post) notFound();

  const related = query<BlogPost>(
    `SELECT * FROM blog_posts
      WHERE status = 'published' AND id != ?
      ORDER BY published_at DESC
      LIMIT 3`,
    post.id,
  );

  const date = longDate(post.published_at ?? post.created_at);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.hero_image,
    datePublished: post.published_at ?? post.created_at,
    author: { '@type': 'Person', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'Atlas' },
    mainEntityOfPage: `/blog/${post.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <header className="section-tight">
          <div className="container-narrow">
            <Breadcrumbs
              items={[
                { href: '/', label: 'Home' },
                { href: '/blog', label: 'The Journal' },
                { label: post.title },
              ]}
            />
            <span className="eyebrow eyebrow-accent">Field notes</span>
            <h1>{post.title}</h1>
            <p className="lead" style={{ marginTop: 'var(--s4)' }}>
              {post.excerpt}
            </p>
            <div className="cluster" style={{ marginTop: 'var(--s5)', fontSize: '0.9rem' }}>
              <span>
                By <strong>{post.author_name}</strong>
              </span>
              <span className="muted" aria-hidden="true">
                ·
              </span>
              <time className="muted" dateTime={(post.published_at ?? post.created_at).slice(0, 10)}>
                {date}
              </time>
              <span className="muted" aria-hidden="true">
                ·
              </span>
              <span className="muted">{readingMinutes(post.body)} min read</span>
            </div>
          </div>
        </header>

        <div className="container" style={{ marginBottom: 'var(--s7)' }}>
          <img
            src={post.hero_image}
            alt={post.title}
            loading="lazy"
            decoding="async"
            width={1200}
            height={800}
            style={{
              width: '100%',
              aspectRatio: '3 / 2',
              objectFit: 'cover',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--line)',
            }}
          />
        </div>

        <div className="container-narrow">
          <div className="prose">{renderBody(post.body)}</div>

          <hr />

          <div className="card card-pad between">
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Written by
              </span>
              <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{post.author_name}</p>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Atlas guiding and operations team, Skopje
              </p>
            </div>
            <Link className="btn btn-primary" href="/tours">
              See the trips this applies to
            </Link>
          </div>
        </div>
      </article>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">Keep reading</span>
              <h2>More from the Journal</h2>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/blog">
              All pieces
            </Link>
          </div>

          {related.length === 0 ? (
            <div className="card empty-state">
              <p style={{ margin: 0 }}>
                This is the only piece published so far. More arrive between
                departures, when the guides are home long enough to write.
              </p>
            </div>
          ) : (
            <div className="grid grid-3">
              {related.map((other) => (
                <article key={other.id} className="card card-link">
                  <Link
                    href={`/blog/${other.slug}`}
                    style={{ display: 'contents', color: 'inherit' }}
                  >
                    <div className="card-media">
                      <img
                        src={other.hero_image}
                        alt={other.title}
                        loading="lazy"
                        decoding="async"
                        width={600}
                        height={400}
                      />
                    </div>
                    <div className="card-body">
                      <span className="eyebrow" style={{ margin: 0 }}>
                        {longDate(other.published_at ?? other.created_at)}
                      </span>
                      <h3 className="card-title">{other.title}</h3>
                      <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                        {other.excerpt}
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
