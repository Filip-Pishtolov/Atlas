import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import SimpleCrud from '@/components/admin/SimpleCrud';
import type { CrudColumn, CrudField, CrudRow } from '@/components/admin/SimpleCrud';

export const metadata = { title: 'Journal' };

const COLUMNS: CrudColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'URL slug', kind: 'mono' },
  { key: 'author_name', label: 'Author' },
  { key: 'status', label: 'Status', kind: 'badge' },
  { key: 'published_at', label: 'Published', kind: 'date' },
  { key: 'excerpt', label: 'Excerpt', kind: 'muted' },
];

const FIELDS: CrudField[] = [
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    full: true,
    placeholder: 'What a guided trek actually costs, line by line',
  },
  {
    name: 'slug',
    label: 'URL slug',
    type: 'text',
    required: true,
    placeholder: 'what-a-guided-trek-costs',
    hint: 'Becomes /journal/what-a-guided-trek-costs. Fix it before publishing, not after.',
  },
  {
    name: 'author_name',
    label: 'Author',
    type: 'text',
    required: true,
    placeholder: 'Sara Whelan',
    hint: 'The by-line shown on the post.',
  },
  {
    name: 'excerpt',
    label: 'Excerpt',
    type: 'textarea',
    required: true,
    full: true,
    placeholder:
      'Guides, permits, mountain huts, the van from the airport: here is where the money on a seven-day Atlas trek really goes.',
    hint: 'One or two sentences, shown on the journal index and in link previews.',
  },
  {
    name: 'body',
    label: 'Body',
    type: 'textarea',
    required: true,
    full: true,
    placeholder: 'Write the post here. Blank lines separate paragraphs.',
    hint: 'Plain text. Blank lines become paragraphs on the public page.',
  },
  {
    name: 'hero_image',
    label: 'Hero image URL',
    type: 'text',
    required: true,
    full: true,
    placeholder: 'https://picsum.photos/seed/journal-costs/1200/800',
    hint: 'Landscape, at least 1200×800.',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'draft', label: 'Draft — only visible here' },
      { value: 'published', label: 'Published — live on the site' },
    ],
  },
  {
    name: 'published_at',
    label: 'Publication date',
    type: 'text',
    placeholder: '2026-09-01 09:00:00',
    hint: 'Format YYYY-MM-DD HH:MM:SS. Posts are ordered newest first by this date.',
  },
];

export default async function AdminBlogPage() {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/blog');

  const rows = query<CrudRow>(
    `SELECT * FROM blog_posts
      ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END,
               COALESCE(published_at, created_at) DESC`,
  );

  const drafts = rows.filter((r) => r.status === 'draft').length;

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Content</span>
          <h1>Journal</h1>
          <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
            {drafts === 0
              ? 'Everything written is published. Drafts appear at the top of this list.'
              : `${drafts} ${drafts === 1 ? 'draft is' : 'drafts are'} unpublished and invisible to visitors.`}
          </p>
        </div>
      </div>

      <SimpleCrud
        noun="blog post"
        endpoint="/api/admin/blog"
        rows={rows}
        columns={COLUMNS}
        fields={FIELDS}
        titleKey="title"
        emptyMessage="Nothing written yet. The journal is the cheapest way Atlas earns search traffic — start with one honest post about how a departure is put together."
      />
    </>
  );
}
