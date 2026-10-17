import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Cancellation policy',
  description:
    'What it costs to cancel an Atlas trip, worked through with real numbers, plus what happens when we cancel, when we waive charges, and how refunds are paid.',
};

const SCALE = [
  { window: '60+ days before', pct: 20, label: 'Deposit only' },
  { window: '60 to 31 days', pct: 50, label: 'Half the trip price' },
  { window: '30 to 15 days', pct: 75, label: 'Three quarters' },
  { window: '14 days or fewer', pct: 100, label: 'The full price' },
];

const EXAMPLE_TOTAL_CENTS = 248_000;
const EXAMPLE_DEPOSIT_CENTS = Math.round((EXAMPLE_TOTAL_CENTS * 0.2) / 100) * 100;

export default async function CancellationPolicyPage() {
  return (
    <>
      <section className="section-tight" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Cancellation policy' }]} />
          <span className="eyebrow eyebrow-accent">Version 4.2 · In force from 1 March 2026</span>
          <h1>Cancellation policy</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Nobody books a trip planning to cancel it, so this page exists to make
            the cost of doing so completely predictable before you pay us anything.
            The figures below are the same ones used by clause 6 of our booking
            conditions.
          </p>
          <p className="alert alert-warn" style={{ marginTop: 'var(--s5)' }}>
            <strong>Please note:</strong> Atlas is a fictional tour operator created
            for a university coursework project. This policy is an illustrative
            sample written to show how a real cancellation policy is structured. It
            has no legal force and nothing on this site can be booked.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <div className="prose">
            <h2>If you cancel</h2>
            <p>
              Cancellation takes effect on the day we receive written notice — email
              to <span className="mono">trips@atlas.travel</span> is fine — from the
              lead traveller. Charges are a percentage of the total booking price,
              not of the balance outstanding:
            </p>
          </div>

          <div className="table-wrap" style={{ margin: 'var(--s5) 0' }}>
            <table className="table">
              <caption className="sr-only">
                Cancellation charge by notice period, with a worked example on a
                booking of {formatMoney(EXAMPLE_TOTAL_CENTS)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Notice we receive</th>
                  <th scope="col">You are charged</th>
                  <th scope="col" className="num">
                    On a {formatMoney(EXAMPLE_TOTAL_CENTS)} booking
                  </th>
                  <th scope="col" className="num">
                    Refunded to you
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCALE.map((row) => {
                  const charge = Math.round((EXAMPLE_TOTAL_CENTS * row.pct) / 100);
                  return (
                    <tr key={row.window}>
                      <td>
                        <strong>{row.window}</strong>
                        <br />
                        <span className="muted" style={{ fontSize: '0.82rem' }}>
                          {row.label}
                        </span>
                      </td>
                      <td className="tabular">{row.pct}% of the total</td>
                      <td className="num tabular">{formatMoney(charge)}</td>
                      <td className="num tabular">
                        {formatMoney(EXAMPLE_TOTAL_CENTS - charge)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="prose">
            <h3>The worked example in full</h3>
            <p>
              Two people book a {formatMoney(EXAMPLE_TOTAL_CENTS)} trip and pay a
              deposit of {formatMoney(EXAMPLE_DEPOSIT_CENTS)}. If they cancel 70
              days out, the charge is the deposit and nothing more — they have paid
              nothing else, so there is nothing to refund and nothing further to
              pay. If they cancel 40 days out, having by then paid the balance in
              full, the charge is {formatMoney(Math.round(EXAMPLE_TOTAL_CENTS / 2))}{' '}
              and we refund the other{' '}
              {formatMoney(EXAMPLE_TOTAL_CENTS - Math.round(EXAMPLE_TOTAL_CENTS / 2))}.
              If they cancel 12 days out, there is no refund and the claim goes to
              their insurer.
            </p>

            <h3>Why deposits are not refundable</h3>
            <p>
              A deposit is not a holding fee we sit on. The day it arrives it goes
              out again: a retainer to the guide who blocked those dates, a deposit
              to a family guesthouse with eight rooms and no other way to plan, a
              permit that has to be applied for months ahead. Those payments are not
              returned to us when one booking cancels, which is why they are not
              returned to you.
            </p>

            <h2>When we waive the charge</h2>
            <p>
              The scale above is what we are entitled to charge. It is not always
              what we do. We waive or reduce charges, at our discretion and without
              creating a precedent, in cases including:
            </p>
            <ul>
              <li>
                the death of a traveller on the booking, or of a partner, parent,
                sibling or child;
              </li>
              <li>
                a government travel advisory against the region issued after you
                booked;
              </li>
              <li>
                where you find someone to take your place — the transfer fee in
                clause 7 applies instead, and it is far cheaper.
              </li>
            </ul>
            <p>
              We do not waive charges for a change of mind, a cheaper trip found
              elsewhere, a refused visa, or a missed flight. Those are what
              insurance is for, and insurance is a condition of booking with us.
            </p>

            <h2>If we cancel</h2>
            <p>
              We may cancel a departure that has not reached its minimum of six
              travellers, but never later than 45 days before departure, and we
              telephone rather than email. We may also cancel where unavoidable and
              extraordinary circumstances make the trip unsafe or impossible.
            </p>
            <p>In either case you may:</p>
            <ul>
              <li>move to another date at the price you originally paid;</li>
              <li>
                move to a different trip, paying or receiving the difference in
                price; or
              </li>
              <li>take a full refund of everything paid to us.</li>
            </ul>
            <p>
              Refunds are paid within <strong>14 days</strong>, to the method you
              paid with. We do not offer credit notes in place of refunds, and we
              never have. Where we cancel within 30 days of departure for a reason
              inside our control, we also pay €50 per traveller towards the costs
              you cannot recover.
            </p>

            <h2>Unused services</h2>
            <p>
              If you leave a trip early, miss a portion of it, or decline part of the
              itinerary, no refund is due for the unused services — our costs are
              committed for the whole group. If you leave for medical reasons your
              guide will document everything your insurer needs, the same day.
            </p>

            <h2>How to cancel</h2>
            <p>
              Write to <span className="mono">trips@atlas.travel</span> from the lead
              traveller&rsquo;s email address, quoting the booking reference. We
              acknowledge within one working day with a statement of exactly what is
              charged and what is refunded, and the refund follows within 14 days.
              Please do not cancel by voicemail — we cannot act on it.
            </p>
          </div>

          <div className="card card-pad between" style={{ marginTop: 'var(--s7)' }}>
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Before you cancel
              </span>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem', maxWidth: '44ch' }}>
                Talk to us first. Moving to another date, or transferring your place
                to a friend, almost always costs less than cancelling.
              </p>
            </div>
            <div className="cluster">
              <Link className="btn btn-primary btn-sm" href="/contact">
                Talk to the office
              </Link>
              <Link className="btn btn-secondary btn-sm" href="/legal/booking-conditions">
                Booking conditions
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
