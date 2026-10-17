import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import ContactForm, { type ContactTourOption } from '@/components/ContactForm';
import { listTours } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact Atlas',
  description:
    'Talk to the four people who plan and run Atlas trips. Office in Skopje, replies within one working day, and a 24-hour number while any group is in the field.',
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ContactPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tourSlug = firstParam(params.tour);

  const tours = listTours({});
  const options: ContactTourOption[] = tours.map((tour) => ({
    id: tour.id,
    title: tour.title,
    destination_name: tour.destination_name,
  }));

  const preselected = tourSlug ? tours.find((tour) => tour.slug === tourSlug) : undefined;

  return (
    <>
      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Contact' }]} />
          <span className="eyebrow eyebrow-accent">Talk to us</span>
          <h1>Eleven people, one office, no call centre</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Ask us anything before you book — whether a grade is right for you,
            whether a date will run, whether the walking is really six hours. We
            would rather spend twenty minutes talking you out of the wrong trip
            than refund you afterwards.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="grid grid-3">
            <div className="kpi kpi-good">
              <span className="kpi-label">Typical first reply</span>
              <span className="kpi-value">4h</span>
              <span className="kpi-note">During office hours, Mon–Fri</span>
            </div>
            <div className="kpi kpi-accent">
              <span className="kpi-label">Guaranteed within</span>
              <span className="kpi-value">1 day</span>
              <span className="kpi-note">One working day, every enquiry</span>
            </div>
            <div className="kpi kpi-warn">
              <span className="kpi-label">While a group is out</span>
              <span className="kpi-value">24h</span>
              <span className="kpi-note">Duty phone, answered by staff</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              alignItems: 'start',
            }}
          >
            <div>
              {preselected && (
                <p className="alert alert-info" style={{ marginBottom: 'var(--s5)' }}>
                  Your enquiry is set to <strong>{preselected.title}</strong> in{' '}
                  {preselected.destination_name}.{' '}
                  <Link href={`/tours/${preselected.slug}`}>Back to the trip page</Link>
                </p>
              )}

              <ContactForm
                tours={options}
                initialTourId={preselected?.id ?? null}
                initialSubject={preselected ? `Enquiry about ${preselected.title}` : ''}
              />
            </div>

            <aside className="stack stack-lg">
              <div className="card card-pad stack">
                <span className="eyebrow eyebrow-accent">The office</span>
                <address style={{ fontStyle: 'normal', lineHeight: 1.7 }}>
                  Atlas Travel d.o.o.
                  <br />
                  Ulica Makedonija 27, second floor
                  <br />
                  1000 Skopje
                  <br />
                  North Macedonia
                </address>
                <dl className="meta-list">
                  <div className="meta-item">
                    <dt>Telephone</dt>
                    <dd className="mono">+389 2 300 1188</dd>
                  </div>
                  <div className="meta-item">
                    <dt>Email</dt>
                    <dd className="mono">hello@atlas.travel</dd>
                  </div>
                  <div className="meta-item">
                    <dt>Existing bookings</dt>
                    <dd className="mono">trips@atlas.travel</dd>
                  </div>
                  <div className="meta-item">
                    <dt>Press and partners</dt>
                    <dd className="mono">office@atlas.travel</dd>
                  </div>
                </dl>
              </div>

              <div className="card card-pad stack">
                <span className="eyebrow eyebrow-accent">When we are here</span>
                <div className="table-wrap">
                  <table className="table">
                    <caption className="sr-only">Atlas office opening hours</caption>
                    <tbody>
                      <tr>
                        <td>Monday to Friday</td>
                        <td className="num mono">09:00–18:00</td>
                      </tr>
                      <tr>
                        <td>Saturday</td>
                        <td className="num mono">10:00–14:00</td>
                      </tr>
                      <tr>
                        <td>Sunday</td>
                        <td className="num muted">Closed</td>
                      </tr>
                      <tr>
                        <td>Duty phone, groups in the field</td>
                        <td className="num mono">24 hours</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  All times are Central European Time. The Saturday desk is one
                  person, so complicated questions are better sent on a weekday.
                </p>
              </div>

              <div className="card card-pad stack">
                <span className="eyebrow eyebrow-accent">In an emergency</span>
                <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                  If you are travelling with us right now, or your group departs
                  within 48 hours, do not use this form. Call the duty line on{' '}
                  <span className="mono">+389 70 442 900</span>. It rings a member
                  of Atlas staff at any hour, and it is the number printed on your
                  final documents.
                </p>
              </div>

              <div className="card card-pad stack">
                <span className="eyebrow eyebrow-accent">Might be quicker</span>
                <ul style={{ margin: 0, paddingLeft: '1.1em', fontSize: '0.94rem' }}>
                  <li>
                    <Link href="/faq">Twelve questions we are asked most</Link>
                  </li>
                  <li>
                    <Link href="/legal/booking-conditions">
                      Deposits, balances and what happens if plans change
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/cancellation">Cancellation charges by date</Link>
                  </li>
                  <li>
                    <Link href="/deals">Offers running at the moment</Link>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
