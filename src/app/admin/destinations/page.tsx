import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import SimpleCrud from '@/components/admin/SimpleCrud';
import type { CrudColumn, CrudField, CrudRow } from '@/components/admin/SimpleCrud';

export const metadata = { title: 'Destinations' };

const COLUMNS: CrudColumn[] = [
  { key: 'name', label: 'Destination' },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region', kind: 'muted' },
  { key: 'slug', label: 'URL slug', kind: 'mono' },
  { key: 'tour_count', label: 'Tours', kind: 'num' },
  { key: 'best_time', label: 'Best time', kind: 'muted' },
  { key: 'is_featured', label: 'Featured', kind: 'bool' },
];

const FIELDS: CrudField[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    placeholder: 'High Atlas',
  },
  {
    name: 'slug',
    label: 'URL slug',
    type: 'text',
    required: true,
    placeholder: 'high-atlas',
    hint: 'Lower case, hyphens only. It becomes /destinations/high-atlas and should never change once published.',
  },
  {
    name: 'country',
    label: 'Country',
    type: 'text',
    required: true,
    placeholder: 'Morocco',
  },
  {
    name: 'region',
    label: 'Region',
    type: 'text',
    placeholder: 'North Africa',
    hint: 'Optional. Used to group destinations on the index page.',
  },
  {
    name: 'summary',
    label: 'Summary',
    type: 'textarea',
    required: true,
    full: true,
    placeholder:
      'Berber villages, mule tracks and the highest peak in North Africa, two hours from Marrakech.',
    hint: 'One or two sentences. Shown on destination cards and in search results.',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    required: true,
    full: true,
    placeholder:
      'The High Atlas rises straight out of the Haouz plain south of Marrakech...',
    hint: 'The full introduction on the destination page.',
  },
  {
    name: 'hero_image',
    label: 'Hero image URL',
    type: 'text',
    required: true,
    full: true,
    placeholder: 'https://picsum.photos/seed/high-atlas/1200/800',
    hint: 'Landscape, at least 1200×800. Use the picsum.photos seed pattern for placeholders.',
  },
  {
    name: 'best_time',
    label: 'Best time to visit',
    type: 'text',
    placeholder: 'April to June, September to October',
  },
  {
    name: 'is_featured',
    label: 'Feature on the home page',
    type: 'checkbox',
    full: true,
    hint: 'Featured destinations appear in the home page grid. Three or four is plenty.',
  },
];

export default async function AdminDestinationsPage() {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/destinations');

  const rows = query<CrudRow>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM tours t WHERE t.destination_id = d.id) AS tour_count
       FROM destinations d
      ORDER BY d.name`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Content</span>
          <h1>Destinations</h1>
          <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
            Every tour belongs to a destination, and destination-scoped promotions key
            off this list. A destination with tours attached cannot be deleted.
          </p>
        </div>
      </div>

      <SimpleCrud
        noun="destination"
        endpoint="/api/admin/destinations"
        rows={rows}
        columns={COLUMNS}
        fields={FIELDS}
        titleKey="name"
        emptyMessage="No destinations yet. Add the first one — a name, a country and a slug are enough to start."
      />
    </>
  );
}
