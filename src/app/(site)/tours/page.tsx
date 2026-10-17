import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import TourCard from '@/components/TourCard';
import TourFilters from '@/components/TourFilters';
import {
  countTours,
  listDestinations,
  listThemes,
  listTours,
  liveAutomaticPromotions,
} from '@/lib/queries';
import type { TourFilters as TourFilterInput } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All small-group tours',
  description:
    'Every Atlas departure: guided small-group journeys across the Mediterranean, the Balkans and North Africa. Filter by destination, travel style, pace, length or budget.',
};

const PAGE_SIZE = 9;

const SORTS = ['popular', 'price_asc', 'price_desc', 'duration_asc', 'soonest'] as const;
const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'tough'] as const;

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function durationRange(value: string | undefined): {
  minDurationDays?: number;
  maxDurationDays?: number;
} {
  switch (value) {
    case '1-6':
      return { maxDurationDays: 6 };
    case '7-9':
      return { minDurationDays: 7, maxDurationDays: 9 };
    case '10+':
      return { minDurationDays: 10 };
    default:
      return {};
  }
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const destination = one(sp.destination);
  const theme = one(sp.theme);
  const rawDifficulty = one(sp.difficulty);
  const difficulty = DIFFICULTIES.includes(rawDifficulty as (typeof DIFFICULTIES)[number])
    ? rawDifficulty
    : undefined;
  const duration = one(sp.duration);
  const search = one(sp.search);

  const rawSort = one(sp.sort);
  const sort = SORTS.includes(rawSort as (typeof SORTS)[number])
    ? (rawSort as TourFilterInput['sort'])
    : 'popular';

  const rawPrice = Number(one(sp.maxPrice));
  const maxPriceCents =
    Number.isFinite(rawPrice) && rawPrice > 0 ? Math.floor(rawPrice) : undefined;

  const filters: TourFilterInput = {
    destination,
    theme,
    difficulty,
    ...durationRange(duration),
    maxPriceCents,
    search,
    sort,
  };

  const total = countTours(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const requestedPage = Number(one(sp.page) ?? '1');
  const page = Math.min(
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
    totalPages,
  );

  const tours = listTours({
    ...filters,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const promotions = liveAutomaticPromotions();
  const destinations = listDestinations();
  const themes = listThemes();

  const hasFilters = Boolean(
    destination || theme || difficulty || duration || maxPriceCents || search,
  );

  function hrefForPage(target: number): string {
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (theme) params.set('theme', theme);
    if (difficulty) params.set('difficulty', difficulty);
    if (duration) params.set('duration', duration);
    if (maxPriceCents) params.set('maxPrice', String(maxPriceCents));
    if (search) params.set('search', search);
    if (sort && sort !== 'popular') params.set('sort', sort);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/tours?${qs}` : '/tours';
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="container section">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Tours' }]} />

      <div className="section-head section-head-line">
        <div className="stack stack-sm" style={{ maxWidth: '58ch' }}>
          <span className="eyebrow eyebrow-accent">The catalogue</span>
          <h1>Small-group tours</h1>
          <p className="lead">
            Sixteen travellers at most, a guide who lives where you are going,
            and a fixed departure date you can actually plan around. Every price
            below is per person for the next date on sale.
          </p>
        </div>
      </div>

      <div className="stack stack-lg">
        <Suspense
          fallback={
            <div className="card card-pad">
              <p className="muted">Loading filters…</p>
            </div>
          }
        >
          <TourFilters destinations={destinations} themes={themes} />
        </Suspense>

        <div className="between">
          <p className="muted" aria-live="polite" style={{ margin: 0 }}>
            <strong className="tabular">{total}</strong>{' '}
            {total === 1 ? 'tour' : 'tours'}
            {hasFilters ? ' match your filters' : ' currently on sale'}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
          </p>
          {hasFilters && (
            <Link className="btn btn-ghost btn-sm" href="/tours">
              Clear filters
            </Link>
          )}
        </div>

        {tours.length === 0 ? (
          <div className="card empty-state">
            <h2 style={{ marginBottom: 'var(--s3)' }}>No tours match that</h2>
            <p style={{ marginBottom: 'var(--s5)' }}>
              Nothing in the current catalogue fits every filter you picked. Try
              widening the budget or the trip length — or tell us what you have
              in mind and we will build it.
            </p>
            <div className="cluster" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary" href="/tours">
                Clear all filters
              </Link>
              <Link className="btn btn-secondary" href="/contact">
                Ask us to plan it
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-3">
            {tours.map((tour) => (
              <TourCard key={tour.id} tour={tour} promotions={promotions} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Tour listing pages">
            {page > 1 ? (
              <Link href={hrefForPage(page - 1)} rel="prev">
                Previous
              </Link>
            ) : (
              <span aria-hidden="true" style={{ opacity: 0.4 }}>
                Previous
              </span>
            )}

            {pageNumbers.map((n) =>
              n === page ? (
                <span key={n} className="current" aria-current="page">
                  {n}
                </span>
              ) : (
                <Link key={n} href={hrefForPage(n)}>
                  {n}
                </Link>
              ),
            )}

            {page < totalPages ? (
              <Link href={hrefForPage(page + 1)} rel="next">
                Next
              </Link>
            ) : (
              <span aria-hidden="true" style={{ opacity: 0.4 }}>
                Next
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
