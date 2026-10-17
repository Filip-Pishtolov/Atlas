import type { Metadata } from 'next';
import Link from 'next/link';
import TourEditor from '@/components/admin/TourEditor';
import { listDestinations, listThemes } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New tour',
};

export default async function NewTourPage() {
  const destinations = listDestinations();
  const themes = listThemes();

  return (
    <>
      <div className="admin-head">
        <div className="stack stack-sm">
          <p className="eyebrow-accent">Catalogue</p>
          <h1>New tour</h1>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            Nothing is written until you save, so you can draft the whole thing
            in one pass. Start it as a draft and publish once the itinerary and
            photographs are in.
          </p>
        </div>
        <Link href="/admin/tours" className="btn btn-ghost btn-sm">
          Back to tours
        </Link>
      </div>

      {destinations.length === 0 ? (
        <div className="card empty-state stack">
          <p>
            A tour has to belong to a destination, and there are none yet. Add
            the destination first, then come back and write the tour.
          </p>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link href="/admin/destinations" className="btn btn-primary">
              Go to destinations
            </Link>
          </div>
        </div>
      ) : (
        <TourEditor
          mode="create"
          destinations={destinations}
          themes={themes}
        />
      )}
    </>
  );
}
