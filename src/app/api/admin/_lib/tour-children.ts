import { get, run } from '@/lib/db';
import { fail, int, listOf, ok, oneOf, optText, readArray, text } from './http';
import type { Parsed } from './http';

export interface ItineraryInput {
  day_number: number;
  title: string;
  description: string;
  meals: string | null;
  accommodation: string | null;
}

export interface FactInput {
  kind: 'included' | 'excluded';
  text: string;
  sort_order: number;
}

export interface ImageInput {
  url: string;
  alt: string;
  sort_order: number;
}

const FACT_KINDS = ['included', 'excluded'] as const;

function asRecord(row: unknown): Record<string, unknown> | null {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return null;
  return row as Record<string, unknown>;
}

export function parseItinerary(raw: unknown): Parsed<ItineraryInput[]> {
  const rows = readArray(raw);
  if (rows === null) return fail('`itinerary` must be an array of days.');

  const days: ItineraryInput[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const row = asRecord(rows[i]);
    if (!row) return fail(`itinerary[${i}] must be an object.`);

    const dayNumber = int(row.day_number) ?? i + 1;
    if (dayNumber < 1) return fail(`itinerary[${i}].day_number must be 1 or more.`);
    if (seen.has(dayNumber)) {
      return fail(`itinerary[${i}] repeats day ${dayNumber}.`);
    }
    seen.add(dayNumber);

    const title = text(row.title);
    if (!title) return fail(`itinerary[${i}].title is required.`);

    const description = text(row.description);
    if (!description) return fail(`itinerary[${i}].description is required.`);

    days.push({
      day_number: dayNumber,
      title,
      description,
      meals: optText(row.meals),
      accommodation: optText(row.accommodation),
    });
  }

  days.sort((a, b) => a.day_number - b.day_number);
  return ok(days);
}

export function writeItinerary(tourId: number, days: ItineraryInput[]): void {
  run('DELETE FROM itinerary_days WHERE tour_id = ?', tourId);
  for (const day of days) {
    run(
      `INSERT INTO itinerary_days
         (tour_id, day_number, title, description, meals, accommodation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      tourId,
      day.day_number,
      day.title,
      day.description,
      day.meals,
      day.accommodation,
    );
  }
}

export function parseFacts(raw: unknown): Parsed<FactInput[]> {
  const rows = readArray(raw);
  if (rows === null) return fail('`facts` must be an array.');

  const facts: FactInput[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = asRecord(rows[i]);
    if (!row) return fail(`facts[${i}] must be an object.`);

    const kind = oneOf(row.kind, FACT_KINDS);
    if (!kind) return fail(`facts[${i}].kind must be ${listOf(FACT_KINDS)}.`);

    const body = text(row.text);
    if (!body) return fail(`facts[${i}].text is required.`);

    facts.push({ kind, text: body, sort_order: int(row.sort_order) ?? i });
  }

  return ok(facts);
}

export function writeFacts(tourId: number, facts: FactInput[]): void {
  run('DELETE FROM tour_facts WHERE tour_id = ?', tourId);
  for (const fact of facts) {
    run(
      'INSERT INTO tour_facts (tour_id, kind, text, sort_order) VALUES (?, ?, ?, ?)',
      tourId,
      fact.kind,
      fact.text,
      fact.sort_order,
    );
  }
}

export function parseImages(raw: unknown): Parsed<ImageInput[]> {
  const rows = readArray(raw);
  if (rows === null) return fail('`images` must be an array.');

  const images: ImageInput[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = asRecord(rows[i]);
    if (!row) return fail(`images[${i}] must be an object.`);

    const url = text(row.url);
    if (!url) return fail(`images[${i}].url is required.`);
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      return fail(`images[${i}].url must be an http(s) URL or a site-root path.`);
    }

    const alt = text(row.alt);
    if (!alt) return fail(`images[${i}].alt is required (describe the photo).`);

    images.push({ url, alt, sort_order: int(row.sort_order) ?? i });
  }

  return ok(images);
}

export function writeImages(tourId: number, images: ImageInput[]): void {
  run('DELETE FROM tour_images WHERE tour_id = ?', tourId);
  for (const image of images) {
    run(
      'INSERT INTO tour_images (tour_id, url, alt, sort_order) VALUES (?, ?, ?, ?)',
      tourId,
      image.url,
      image.alt,
      image.sort_order,
    );
  }
}

export function parseThemeIds(raw: unknown): Parsed<number[]> {
  const rows = readArray(raw);
  if (rows === null) return fail('`theme_ids` must be an array of theme ids.');

  const ids: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const id = int(rows[i]);
    if (id === null || id <= 0) return fail(`theme_ids[${i}] must be a theme id.`);
    if (ids.includes(id)) continue;

    const theme = get<{ id: number }>('SELECT id FROM themes WHERE id = ?', id);
    if (!theme) return fail(`Theme ${id} does not exist.`);
    ids.push(id);
  }

  return ok(ids);
}

export function writeThemes(tourId: number, themeIds: number[]): void {
  run('DELETE FROM tour_themes WHERE tour_id = ?', tourId);
  for (const themeId of themeIds) {
    run(
      'INSERT INTO tour_themes (tour_id, theme_id) VALUES (?, ?)',
      tourId,
      themeId,
    );
  }
}
