import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Booking conditions',
  description:
    'The contract between you and Atlas: deposits, balance dates, price revision, minimum group numbers, cancellation charges, insurance requirements and how complaints are handled.',
};

const CANCELLATION_SCALE = [
  { window: 'More than 60 days before departure', charge: 'Deposit only (20%)', note: 'Nothing further to pay' },
  { window: '60 to 31 days before departure', charge: '50% of the total price', note: 'Deposit counts towards it' },
  { window: '30 to 15 days before departure', charge: '75% of the total price', note: 'Guides and rooms are committed' },
  { window: '14 days or fewer, or no-show', charge: '100% of the total price', note: 'Claim on your insurance' },
];

export default async function BookingConditionsPage() {
  return (
    <>
      <section className="section-tight" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Home' },
              { label: 'Booking conditions' },
            ]}
          />
          <span className="eyebrow eyebrow-accent">Version 4.2 · In force from 1 March 2026</span>
          <h1>Booking conditions</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            These are the terms on which Atlas Travel d.o.o. sells and operates a
            trip. They are written to be read once, in plain language, rather than
            skimmed and regretted. Where a clause below is less generous than the
            law where you live, the law wins.
          </p>
          <p className="alert alert-warn" style={{ marginTop: 'var(--s5)' }}>
            <strong>Please note:</strong> Atlas is a fictional tour operator created
            for a university coursework project. This document is an illustrative
            sample written to demonstrate the structure of real booking conditions.
            It is not legal advice, it creates no obligations, and nothing on this
            site can be booked.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <div className="prose">
            <h2>1. Who you are contracting with</h2>
            <p>
              Your contract is with Atlas Travel d.o.o., Ulica Makedonija 27, 1000
              Skopje, North Macedonia, registered as a tour operator under licence
              ATL-2019-0442. In these conditions &ldquo;we&rdquo; and
              &ldquo;Atlas&rdquo; mean that company, and &ldquo;you&rdquo; means
              every person named on the booking. The person who makes the booking
              is the lead traveller and is responsible for the whole party&rsquo;s
              payments and for passing our information on to them.
            </p>
            <p>
              A contract exists when we issue a booking confirmation carrying your
              reference. Until that confirmation is issued, no contract exists,
              even if you have paid.
            </p>

            <h2>2. Deposits and the balance</h2>
            <p>
              A deposit of <strong>20% of the total price</strong>, rounded to
              whole euros, is payable when you book. The exact figure is shown to
              you before you confirm.
            </p>
            <p>
              The <strong>balance is due 60 days before departure</strong>. We
              send a reminder ten days beforehand. If you book within 60 days of
              departure, the full price is payable at the time of booking.
            </p>
            <p>
              If a balance is more than 14 days overdue we may treat the booking as
              cancelled by you and apply the charges in clause 6. We would rather
              phone you than do that, and we always try to first.
            </p>

            <h2>3. What the price includes</h2>
            <p>
              Each tour page lists precisely what is included and what is not,
              and that list forms part of your contract. Unless stated otherwise,
              our prices include guiding, accommodation, listed meals, ground
              transport during the itinerary, permits and entrance fees named in
              the itinerary, and all applicable taxes.
            </p>
            <p>
              Prices exclude international flights to and from the meeting point,
              travel insurance, visas, personal equipment, drinks, tips and
              anything described as optional.
            </p>

            <h2>4. Price revision</h2>
            <p>
              The price shown when you book is the price you pay, with one narrow
              exception. We may pass on increases in the cost of transporting you
              (including fuel), in taxes or fees charged by third parties, or in
              exchange rates directly applicable to your trip. If we do:
            </p>
            <ul>
              <li>we absorb the first 2% of any increase ourselves;</li>
              <li>we will never increase the price by more than 8% in total;</li>
              <li>we will never revise a price within 20 days of departure; and</li>
              <li>
                if the same costs fall, we refund the reduction, minus the
                administrative cost of doing so.
              </li>
            </ul>
            <p>
              If an increase would exceed 8% you may accept it, accept an
              alternative trip we offer, or cancel and receive a full refund within
              14 days. We have applied a surcharge once since 2019.
            </p>

            <h2>5. Minimum numbers and guaranteed departures</h2>
            <p>
              Every departure needs <strong>six travellers</strong> to run. Once it
              reaches six we mark it guaranteed and it operates regardless of later
              cancellations.
            </p>
            <p>
              If a departure has not reached six travellers we may cancel it, but
              never later than <strong>45 days before departure</strong>, and we
              will tell you by telephone. You may then transfer to another date at
              your original price, transfer to a different trip paying or receiving
              the difference, or take a full refund paid within 14 days. We do not
              issue credit notes in place of refunds.
            </p>

            <h2>6. If you cancel</h2>
            <p>
              Cancellations take effect on the day we receive written notice from
              the lead traveller. Charges are a percentage of the total booking
              price:
            </p>
          </div>

          <div className="table-wrap" style={{ margin: 'var(--s5) 0' }}>
            <table className="table">
              <caption className="sr-only">
                Cancellation charges by number of days before departure
              </caption>
              <thead>
                <tr>
                  <th scope="col">Notice received</th>
                  <th scope="col">Charge</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {CANCELLATION_SCALE.map((row) => (
                  <tr key={row.window}>
                    <td>{row.window}</td>
                    <td>
                      <strong>{row.charge}</strong>
                    </td>
                    <td className="muted">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="prose">
            <p>
              Deposits are non-refundable because they are spent the day you pay
              them, on guide retainers and accommodation deposits that our own
              suppliers will not return.{' '}
              <Link href="/legal/cancellation">
                Our cancellation policy sets out worked examples
              </Link>{' '}
              and the circumstances in which we waive charges.
            </p>

            <h2>7. Transferring your booking</h2>
            <p>
              Up to <strong>7 days before departure</strong> you may transfer your
              place to someone else who meets the requirements of the trip. We
              charge €40 in administration plus any charge our suppliers make for
              the change, which we pass on at cost and evidence to you. You and the
              person taking your place are jointly liable for anything still owed.
            </p>

            <h2>8. If we change or cancel your trip</h2>
            <p>
              Itineraries are a statement of intent. Weather, road closures,
              political events and the safety judgement of your guide can all
              require a change, and your guide&rsquo;s decision in the field is
              final. Most changes are minor and we simply tell you.
            </p>
            <p>
              A <em>significant</em> change means a change of departure or return
              date, a change in accommodation to a lower category for more than one
              night, a change of destination, or a material reduction in the
              itinerary. Where one occurs before departure you may accept it, accept
              a comparable alternative, or cancel with a full refund within 14 days.
              Where we cancel for any reason other than your non-payment or
              circumstances beyond our control, we also pay compensation of €50 per
              traveller for departures cancelled within 30 days.
            </p>

            <h2>9. Insurance is a condition of travel</h2>
            <p>
              You must hold travel insurance covering medical expenses,
              repatriation, and cancellation for the whole of your trip, and it must
              cover the activities on your itinerary at the altitudes stated. We ask
              for your insurer and policy number 60 days before departure and your
              guide may ask to see it. Travelling without cover is a breach of these
              conditions and we may refuse to carry you, with no refund.
            </p>
            <p>
              Atlas is not an insurance intermediary. We do not sell policies,
              recommend a particular insurer, or receive commission from one.
            </p>

            <h2>10. Passports, visas and health</h2>
            <p>
              Meeting entry requirements is your responsibility. We will tell you
              what applies to the nationalities named on your booking and link to
              the relevant government source, but requirements change and only the
              issuing authority speaks for them. A refused or late visa is treated
              as a cancellation by you under clause 6.
            </p>

            <h2>11. Behaviour</h2>
            <p>
              Our guides may exclude anyone whose behaviour endangers the group,
              distresses other travellers, or damages our relationship with local
              hosts. If that happens, your trip ends there, we owe you no refund and
              you meet your own costs from that point. This clause exists because
              of one man in 2021 and we hope never to use it again.
            </p>

            <h2>12. Our liability</h2>
            <p>
              We accept responsibility for the proper performance of the services in
              your contract, whether we provide them or a supplier does, in
              accordance with the EU Package Travel Directive (2015/2302). We are
              not liable for failures caused by you, by an unconnected third party,
              or by unavoidable and extraordinary circumstances. Where liability is
              limited by an international convention, our liability is limited in the
              same way.
            </p>
            <p>
              Your money is protected against our insolvency by a bond held under
              policy TGV-INS-118204, covering refunds and repatriation.
            </p>

            <h2>13. Complaints</h2>
            <p>
              Tell your guide first, on the day. Almost everything that goes wrong
              on a trip can be fixed on the trip, and a complaint raised three weeks
              later cannot be. If it is not resolved there, write to{' '}
              <span className="mono">complaints@atlas.travel</span> within 28 days
              of returning. We acknowledge within 3 working days and give a full
              reply within 28 days.
            </p>
            <p>
              If our reply does not settle it, you may refer the dispute to the
              Consumer Dispute Resolution Board in Skopje, or use the European
              Commission&rsquo;s online dispute resolution platform. Nothing in this
              clause limits your right to go to court.
            </p>

            <h2>14. Law</h2>
            <p>
              These conditions are governed by the law of North Macedonia, and by the
              mandatory consumer protections of your country of residence where those
              give you more rights.
            </p>
          </div>

          <div className="card card-pad between" style={{ marginTop: 'var(--s7)' }}>
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Related documents
              </span>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
                Version 4.2, published 1 March 2026. Previous versions are kept and
                the version that applies to you is the one in force when you booked.
              </p>
            </div>
            <div className="cluster">
              <Link className="btn btn-secondary btn-sm" href="/legal/cancellation">
                Cancellation policy
              </Link>
              <Link className="btn btn-secondary btn-sm" href="/legal/privacy">
                Privacy policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
