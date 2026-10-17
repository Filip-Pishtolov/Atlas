import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import PromotionEditor from '@/components/admin/PromotionEditor';

export const metadata = { title: 'New promotion' };

export default async function NewPromotionPage() {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/promotions/new');

  const tours = query<{ id: number; label: string }>(
    `SELECT t.id AS id, t.title || ' (' || d.name || ')' AS label
       FROM tours t
       JOIN destinations d ON d.id = t.destination_id
      ORDER BY t.title`,
  );
  const destinations = query<{ id: number; label: string }>(
    `SELECT id, name || ', ' || country AS label FROM destinations ORDER BY name`,
  );
  const themes = query<{ id: number; label: string }>(
    'SELECT id, name AS label FROM themes ORDER BY name',
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Pricing</span>
          <h1>New promotion</h1>
          <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
            Write the rule once. Atlas applies it to every matching booking until the
            end date passes, and the list price underneath stays untouched.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/admin/promotions">
          Back to promotions
        </Link>
      </div>

      <PromotionEditor tours={tours} destinations={destinations} themes={themes} />
    </>
  );
}
