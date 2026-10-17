import { query, get } from './db';
import type {
  BlogPost,
  Departure,
  Destination,
  ItineraryDay,
  Promotion,
  Review,
  Theme,
  Tour,
  TourCardData,
  TourFact,
  TourImage,
} from './types';

const TOUR_CARD_SELECT = `
  SELECT t.*,
         d.name AS destination_name,
         d.slug AS destination_slug,
         d.country AS country,
         (SELECT COUNT(*) FROM reviews r
           WHERE r.tour_id = t.id AND r.status = 'approved') AS review_count,
         (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
           WHERE r.tour_id = t.id AND r.status = 'approved') AS avg_rating,
         (SELECT MIN(dep.start_date) FROM departures dep
           WHERE dep.tour_id = t.id
             AND dep.status IN ('open','guaranteed')
             AND dep.start_date >= date('now')) AS next_departure,
         COALESCE((SELECT MIN(dep.price_cents) FROM departures dep
           WHERE dep.tour_id = t.id
             AND dep.status IN ('open','guaranteed')
             AND dep.start_date >= date('now')), t.base_price_cents) AS min_price_cents
    FROM tours t
    JOIN destinations d ON d.id = t.destination_id
`;

export interface TourFilters {
  destination?: string;
  theme?: string;
  difficulty?: string;
  maxDurationDays?: number;
  minDurationDays?: number;
  maxPriceCents?: number;
  search?: string;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'duration_asc' | 'soonest';
  limit?: number;
  offset?: number;
}

export function listTours(filters: TourFilters = {}): TourCardData[] {
  const where: string[] = [`t.status = 'published'`];
  const params: (string | number)[] = [];

  if (filters.destination) {
    where.push('d.slug = ?');
    params.push(filters.destination);
  }
  if (filters.theme) {
    where.push(
      `EXISTS (SELECT 1 FROM tour_themes tt
                 JOIN themes th ON th.id = tt.theme_id
                WHERE tt.tour_id = t.id AND th.slug = ?)`,
    );
    params.push(filters.theme);
  }
  if (filters.difficulty) {
    where.push('t.difficulty = ?');
    params.push(filters.difficulty);
  }
  if (filters.minDurationDays !== undefined) {
    where.push('t.duration_days >= ?');
    params.push(filters.minDurationDays);
  }
  if (filters.maxDurationDays !== undefined) {
    where.push('t.duration_days <= ?');
    params.push(filters.maxDurationDays);
  }
  if (filters.maxPriceCents !== undefined) {
    where.push('t.base_price_cents <= ?');
    params.push(filters.maxPriceCents);
  }
  if (filters.search) {
    where.push(
      `(t.title LIKE ? OR t.summary LIKE ? OR d.name LIKE ? OR d.country LIKE ?)`,
    );
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const order =
    {
      price_asc: 'min_price_cents ASC',
      price_desc: 'min_price_cents DESC',
      duration_asc: 't.duration_days ASC',
      soonest: 'next_departure ASC',
      popular: 't.is_featured DESC, review_count DESC',
    }[filters.sort ?? 'popular'] ?? 't.is_featured DESC, review_count DESC';

  let sql = `${TOUR_CARD_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}`;

  if (filters.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
    if (filters.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return query<TourCardData>(sql, ...params);
}

export function countTours(filters: TourFilters = {}): number {
  const rows = listTours({ ...filters, limit: undefined, offset: undefined });
  return rows.length;
}

export function getTourBySlug(slug: string): TourCardData | undefined {
  return get<TourCardData>(`${TOUR_CARD_SELECT} WHERE t.slug = ?`, slug);
}

export function getTourById(id: number): Tour | undefined {
  return get<Tour>('SELECT * FROM tours WHERE id = ?', id);
}

export function featuredTours(limit = 6): TourCardData[] {
  return query<TourCardData>(
    `${TOUR_CARD_SELECT}
      WHERE t.status = 'published' AND t.is_featured = 1
      ORDER BY review_count DESC
      LIMIT ?`,
    limit,
  );
}

export function tourImages(tourId: number): TourImage[] {
  return query<TourImage>(
    'SELECT * FROM tour_images WHERE tour_id = ? ORDER BY sort_order, id',
    tourId,
  );
}

export function tourItinerary(tourId: number): ItineraryDay[] {
  return query<ItineraryDay>(
    'SELECT * FROM itinerary_days WHERE tour_id = ? ORDER BY day_number',
    tourId,
  );
}

export function tourFacts(tourId: number): TourFact[] {
  return query<TourFact>(
    'SELECT * FROM tour_facts WHERE tour_id = ? ORDER BY kind DESC, sort_order, id',
    tourId,
  );
}

export function tourThemes(tourId: number): Theme[] {
  return query<Theme>(
    `SELECT th.* FROM themes th
       JOIN tour_themes tt ON tt.theme_id = th.id
      WHERE tt.tour_id = ?
      ORDER BY th.name`,
    tourId,
  );
}

export function tourThemeIds(tourId: number): number[] {
  return query<{ theme_id: number }>(
    'SELECT theme_id FROM tour_themes WHERE tour_id = ?',
    tourId,
  ).map((r) => r.theme_id);
}

export function upcomingDepartures(tourId: number, limit = 12): Departure[] {
  return query<Departure>(
    `SELECT * FROM departures
      WHERE tour_id = ?
        AND start_date >= date('now')
        AND status != 'cancelled'
      ORDER BY start_date
      LIMIT ?`,
    tourId,
    limit,
  );
}

export function getDeparture(id: number): Departure | undefined {
  return get<Departure>('SELECT * FROM departures WHERE id = ?', id);
}

export function tourReviews(tourId: number, limit = 20): Review[] {
  return query<Review>(
    `SELECT * FROM reviews
      WHERE tour_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT ?`,
    tourId,
    limit,
  );
}

export function listDestinations(featuredOnly = false): Destination[] {
  return query<Destination>(
    `SELECT * FROM destinations
      ${featuredOnly ? 'WHERE is_featured = 1' : ''}
      ORDER BY name`,
  );
}

export function getDestinationBySlug(slug: string): Destination | undefined {
  return get<Destination>('SELECT * FROM destinations WHERE slug = ?', slug);
}

export function listThemes(): Theme[] {
  return query<Theme>('SELECT * FROM themes ORDER BY name');
}

export function listBlogPosts(limit = 20): BlogPost[] {
  return query<BlogPost>(
    `SELECT * FROM blog_posts
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT ?`,
    limit,
  );
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return get<BlogPost>('SELECT * FROM blog_posts WHERE slug = ?', slug);
}

export function liveAutomaticPromotions(): Promotion[] {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return query<Promotion>(
    `SELECT * FROM promotions
      WHERE status = 'active'
        AND code IS NULL
        AND starts_at <= ?
        AND ends_at >= ?
      ORDER BY priority DESC`,
    now,
    now,
  );
}

export function livePromotions(): Promotion[] {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return query<Promotion>(
    `SELECT * FROM promotions
      WHERE status = 'active'
        AND starts_at <= ?
        AND ends_at >= ?
      ORDER BY priority DESC, id`,
    now,
    now,
  );
}
