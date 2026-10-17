import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Atlas collects about you, why we are allowed to, how long we keep it, who else sees it, and how to make us delete it.',
};

const DATA_TABLE = [
  {
    what: 'Name, email, phone',
    why: 'To answer an enquiry and to run a booking',
    basis: 'Contract / legitimate interest',
    kept: '2 years from last contact, or 7 years if you booked',
  },
  {
    what: 'Traveller names and dates of birth',
    why: 'Rooming lists, permits, guide manifests',
    basis: 'Contract',
    kept: '7 years (accounting and liability)',
  },
  {
    what: 'Dietary and access needs',
    why: 'So the kitchen and the guide know before you arrive',
    basis: 'Your explicit consent',
    kept: 'Deleted 90 days after the trip ends',
  },
  {
    what: 'Insurance policy number',
    why: 'A condition of travel; needed in a medical emergency',
    basis: 'Contract / vital interests',
    kept: '3 years after the trip ends',
  },
  {
    what: 'Booking totals and payments',
    why: 'Invoicing, tax and audit',
    basis: 'Legal obligation',
    kept: '7 years — this one overrides deletion requests',
  },
  {
    what: 'Account email and password hash',
    why: 'So you can sign in and see your trips',
    basis: 'Contract',
    kept: 'Until you delete the account',
  },
  {
    what: 'Reviews you submit',
    why: 'Published on the trip page after moderation',
    basis: 'Your consent',
    kept: 'Until you ask us to remove it',
  },
  {
    what: 'Newsletter email',
    why: 'The monthly departures email you asked for',
    basis: 'Your consent',
    kept: 'Until you unsubscribe, then 30 days',
  },
];

export default async function PrivacyPage() {
  return (
    <>
      <section className="section-tight" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Privacy policy' }]} />
          <span className="eyebrow eyebrow-accent">Version 3.1 · Last updated 12 February 2026</span>
          <h1>Privacy policy</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Atlas is a small company that sells about ninety departures a year. We
            need surprisingly little about you to do that, and this page says
            exactly what, why, for how long, and how to make it stop.
          </p>
          <p className="alert alert-warn" style={{ marginTop: 'var(--s5)' }}>
            <strong>Please note:</strong> Atlas is a fictional tour operator created
            for a university coursework project. This policy is an illustrative
            sample. No real personal data is processed by this site and no real
            company stands behind these commitments.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <div className="prose">
            <h2>Who is responsible</h2>
            <p>
              The data controller is Atlas Travel d.o.o., Ulica Makedonija 27, 1000
              Skopje, North Macedonia. Privacy questions go to{' '}
              <span className="mono">privacy@atlas.travel</span> and are answered by
              a named person, not a ticketing system. We are small enough not to
              need a statutory Data Protection Officer, and honest enough to say so
              rather than invent one.
            </p>

            <h2>What we collect and why</h2>
            <p>
              Everything in the table below comes from you — typed into a form on
              this site, said on the phone, or written in an email. We do not buy
              lists, we do not enrich your record from data brokers, and we do not
              build a profile of you across other websites.
            </p>
          </div>

          <div className="table-wrap" style={{ margin: 'var(--s5) 0' }}>
            <table className="table">
              <caption className="sr-only">
                Personal data Atlas holds, the reason, the lawful basis and the
                retention period
              </caption>
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col">Why</th>
                  <th scope="col">Lawful basis</th>
                  <th scope="col">Kept for</th>
                </tr>
              </thead>
              <tbody>
                {DATA_TABLE.map((row) => (
                  <tr key={row.what}>
                    <td>
                      <strong>{row.what}</strong>
                    </td>
                    <td className="muted">{row.why}</td>
                    <td className="muted">{row.basis}</td>
                    <td className="muted">{row.kept}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="prose">
            <h2>Passwords</h2>
            <p>
              We never store your password. What is kept is a one-way hash with a
              random salt, which cannot be reversed into the password you chose. No
              member of Atlas staff can read it, tell it to you, or send it to you —
              if you lose it, it is reset, never recovered.
            </p>

            <h2>Who else sees your data</h2>
            <p>
              Only the people who have to, and only the part they need:
            </p>
            <ul>
              <li>
                <strong>Your guide</strong> gets the manifest: names, dietary and
                medical notes relevant to safety, and an emergency contact. Not your
                payment details.
              </li>
              <li>
                <strong>Accommodation and transport suppliers</strong> get the names
                and, where legally required, passport details. Nothing else.
              </li>
              <li>
                <strong>Our payment provider</strong> handles the card details
                directly. Card numbers never reach an Atlas server or an Atlas
                database.
              </li>
              <li>
                <strong>Our accountants and, if it ever came to it, our lawyers.</strong>
              </li>
            </ul>
            <p>
              We do not sell personal data, we do not share it for anyone
              else&rsquo;s marketing, and we have never received a lawful request
              from an authority for traveller records. If we did, and we were
              permitted to tell you, we would.
            </p>

            <h2>Where your data lives</h2>
            <p>
              On servers inside the European Economic Area. Where a supplier on your
              itinerary is outside it — a guesthouse in Morocco needs your name to
              hold a room — that transfer is necessary to perform your contract and
              is limited to what the booking requires.
            </p>

            <h2>Cookies and analytics</h2>
            <p>
              This site sets one cookie that matters:{' '}
              <span className="mono">atlas_session</span>, which keeps you signed in.
              It is strictly necessary, so it needs no consent, and it disappears
              when the session expires. We do not run advertising trackers, and no
              analytics or marketing script loads before you have agreed to it.
            </p>

            <h2>Your rights</h2>
            <p>Under the GDPR you can ask us to:</p>
            <ul>
              <li>
                <strong>Show you</strong> everything we hold about you — we reply
                within 30 days, free of charge, as a readable file rather than a
                database dump.
              </li>
              <li>
                <strong>Correct</strong> anything wrong. Misspelled names on permits
                cause real problems, so please do tell us.
              </li>
              <li>
                <strong>Delete</strong> your data. We will, except where accounting
                law requires us to keep booking and payment records for seven years.
                We will tell you specifically what has been kept and why.
              </li>
              <li>
                <strong>Export</strong> your data in a machine-readable format.
              </li>
              <li>
                <strong>Object</strong> to anything we do on the basis of legitimate
                interest, and <strong>withdraw consent</strong> at any time — for
                the newsletter that is one click, with no retention email and no
                &ldquo;are you sure&rdquo;.
              </li>
            </ul>
            <p>
              If we get it wrong, you can complain to the Agency for Personal Data
              Protection of North Macedonia, or to the supervisory authority where
              you live. We would rather you told us first, but you are not obliged
              to.
            </p>

            <h2>Security, stated honestly</h2>
            <p>
              Traffic is encrypted in transit, access to the booking database is
              limited to the four office staff who need it, and every administrative
              change is written to an audit log with the name of who made it. We are
              a small company: we are not going to claim a security posture we do
              not have. If we ever suffered a breach affecting your data, we would
              notify the regulator within 72 hours and write to you directly.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              Versions are numbered and dated. Where a change materially affects how
              we use data you have already given us, we email you before it takes
              effect rather than quietly reposting the page.
            </p>
          </div>

          <div className="card card-pad between" style={{ marginTop: 'var(--s7)' }}>
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Exercise a right
              </span>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
                Email <span className="mono">privacy@atlas.travel</span> or write to
                the office. We answer within 30 days.
              </p>
            </div>
            <div className="cluster">
              <Link className="btn btn-secondary btn-sm" href="/contact">
                Contact us
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
