import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About Atlas',
  description:
    'Atlas has run small-group journeys across the Mediterranean, the Balkans and North Africa since 2019. Sixteen travellers maximum, local guides on salary, and itineraries walked before they are sold.',
};

interface TeamMember {
  seed: number;
  name: string;
  role: string;
  bio: string;
  since: string;
}

const TEAM: TeamMember[] = [
  {
    seed: 1,
    name: 'Jasna Petrovska',
    role: 'Founder and managing director',
    bio: 'Spent eleven years as a mountain guide in the Šar range and four running operations for a large European coach operator, which is where she learned exactly what she did not want Atlas to become. She still leads two departures a year, mostly so she has to eat her own cooking.',
    since: 'With Atlas since 2019',
  },
  {
    seed: 2,
    name: 'Driton Bekiri',
    role: 'Head of guiding',
    bio: 'Hires, trains and argues with our guides. Driton sets the standard every Atlas trip is measured against: a guide who lives in the region, speaks the language of the place rather than of the brochure, and is paid year-round rather than by the departure.',
    since: 'With Atlas since 2020',
  },
  {
    seed: 3,
    name: 'Sara Ilievska',
    role: 'Trip design and operations',
    bio: 'Builds the itineraries and holds the departure calendar together. Sara is the person who walks a new route before it goes on sale, times the transfers herself, and cuts the day that looked good on a map and turns out to be four hours in a minibus.',
    since: 'With Atlas since 2020',
  },
  {
    seed: 4,
    name: 'Marc Feuillet',
    role: 'Ground partnerships, North Africa',
    bio: 'Based between Marrakech and Skopje. Marc negotiates with the guesthouses, drivers and muleteers we work with, and audits them every season — on pay, on rest days, and on whether they would take their own family on the route we are buying.',
    since: 'With Atlas since 2022',
  },
];

export default async function AboutPage() {
  return (
    <>
      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'About Atlas' }]} />
          <span className="eyebrow eyebrow-accent">Est. 2019 · Skopje</span>
          <h1>A small agency that would rather run sixteen trips well</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Atlas designs and operates guided small-group journeys across the
            Mediterranean, the Balkans and North Africa. We are eleven people in
            one office and about forty guides across nine countries. We do not
            resell other operators&rsquo; departures, and we do not sell a trip we
            have not walked ourselves.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="grid grid-4">
            <div className="kpi kpi-accent">
              <span className="kpi-label">Founded</span>
              <span className="kpi-value">2019</span>
              <span className="kpi-note">Skopje, North Macedonia</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Group size</span>
              <span className="kpi-value">16</span>
              <span className="kpi-note">Maximum, on every departure</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Guides on contract</span>
              <span className="kpi-value">41</span>
              <span className="kpi-note">All resident in the region they lead</span>
            </div>
            <div className="kpi kpi-good">
              <span className="kpi-label">Departures run</span>
              <span className="kpi-value">380</span>
              <span className="kpi-note">Since our first group, April 2019</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="grid grid-2">
            <div>
              <span className="eyebrow">Our story</span>
              <h2>It started because a trip was cancelled badly</h2>
              <div className="prose" style={{ marginTop: 'var(--s5)' }}>
                <p>
                  In the spring of 2018 Jasna Petrovska was guiding a group of
                  twenty-eight through the Macedonian highlands for an operator
                  who had sold the departure as &ldquo;intimate&rdquo;. Halfway
                  through, head office cancelled the following week&rsquo;s group
                  by email because it had only reached nine bookings. Nine people
                  had booked flights. Nobody phoned them.
                </p>
                <p>
                  Atlas was registered eight months later, in January 2019, on two
                  rules that have not moved since. Sixteen travellers is the
                  ceiling, not the target. And a departure is guaranteed the moment
                  it reaches six people — after that it runs, even at a loss, even
                  if half the group cancels the week before.
                </p>
                <p>
                  We ran nine departures in our first year and lost money on four
                  of them. We ran ninety-four last year and lost money on two. The
                  rule has not changed, we have just become better at judging which
                  dates will fill.
                </p>
              </div>
            </div>

            <div>
              <span className="eyebrow">How a trip gets built</span>
              <h2>Twelve to eighteen months, and a lot of walking</h2>
              <div className="prose" style={{ marginTop: 'var(--s5)' }}>
                <p>
                  Every Atlas itinerary starts with a guide who lives there telling
                  us about a route, not with a search for what sells. Sara then
                  walks it end to end in the season we intend to sell it — not in
                  perfect June weather if the departures are in October.
                </p>
                <p>
                  What follows is the unglamorous part: timing every transfer with
                  a stopwatch, eating in the places we intend to book, sleeping in
                  the rooms, and checking whether the guesthouse actually has the
                  eight rooms it claims. Roughly a third of routes are dropped at
                  this stage. Another third come back shorter than proposed,
                  usually because a driving day that reads as &ldquo;scenic
                  transfer&rdquo; is in reality five hours of switchbacks.
                </p>
                <p>
                  Only then is the trip costed, priced and published — with the
                  day-by-day itinerary, the honest difficulty grade, and what is
                  and is not included written out on the tour page, before you pay
                  anything.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">What small-group means here</span>
              <h2>Four commitments we will not trade away</h2>
            </div>
          </div>

          <div className="grid grid-4">
            <div className="card card-pad stack">
              <span className="badge badge-accent">01</span>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.08rem', fontWeight: 600 }}>
                Sixteen people, hard ceiling
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                No overbooking, no &ldquo;we made an exception for a couple&rdquo;.
                Most of our walking trips cap lower — twelve, sometimes ten where
                the guesthouses are small.
              </p>
            </div>
            <div className="card card-pad stack">
              <span className="badge badge-accent">02</span>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.08rem', fontWeight: 600 }}>
                Local guides, paid properly
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                Our guides are on annual contracts, not per-departure fees, and
                they live in the country they lead in. Tips are welcome but never
                built into anyone&rsquo;s income.
              </p>
            </div>
            <div className="card card-pad stack">
              <span className="badge badge-accent">03</span>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.08rem', fontWeight: 600 }}>
                Prices that do not move
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                The price you book is the price you pay. Discounts are published
                rules with end dates, and every price change we have ever made is
                logged and provable.
              </p>
            </div>
            <div className="card card-pad stack">
              <span className="badge badge-accent">04</span>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.08rem', fontWeight: 600 }}>
                Guaranteed at six
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                Once a departure reaches six travellers it is confirmed and it
                runs. You can book flights on a guaranteed departure without
                holding your breath.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">The office</span>
              <h2>Who you will actually be dealing with</h2>
            </div>
            <p className="muted" style={{ margin: 0, maxWidth: '36ch', fontSize: '0.92rem' }}>
              Enquiries are answered by one of these four, not by a shared inbox
              rota. Whoever replies to you stays with your booking.
            </p>
          </div>

          <div className="grid grid-4">
            {TEAM.map((person) => (
              <article key={person.seed} className="card">
                <div className="card-media" style={{ aspectRatio: '1 / 1' }}>
                  <img
                    src={`https://picsum.photos/seed/atlas-team-${person.seed}/400/400`}
                    alt={`${person.name}, ${person.role} at Atlas`}
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={400}
                  />
                </div>
                <div className="card-body">
                  <h3 className="card-title">{person.name}</h3>
                  <span className="eyebrow" style={{ margin: 0 }}>
                    {person.role}
                  </span>
                  <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                    {person.bio}
                  </p>
                  <div className="card-foot">
                    <span className="muted" style={{ fontSize: '0.82rem' }}>
                      {person.since}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="grid grid-2">
            <div className="card card-pad stack">
              <span className="eyebrow eyebrow-accent">Licence and financial protection</span>
              <h2 style={{ fontSize: 'clamp(1.5rem, 1.2rem + 1vw, 2rem)' }}>
                Your money is protected before it reaches us
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Atlas Travel d.o.o. is registered as a tour operator with the
                Ministry of Economy of North Macedonia under licence{' '}
                <span className="mono">ATL-2019-0442</span>, and holds the
                insolvency protection required of package organisers under the EU
                Package Travel Directive (2015/2302).
              </p>
              <dl className="meta-list">
                <div className="meta-item">
                  <dt>Legal entity</dt>
                  <dd>Atlas Travel d.o.o.</dd>
                </div>
                <div className="meta-item">
                  <dt>Operator licence</dt>
                  <dd className="mono">ATL-2019-0442</dd>
                </div>
                <div className="meta-item">
                  <dt>Insolvency bond</dt>
                  <dd className="mono">TGV-INS-118204</dd>
                </div>
                <div className="meta-item">
                  <dt>VAT number</dt>
                  <dd className="mono">MK4080019608841</dd>
                </div>
              </dl>
              <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                Deposits and balances are held in a client account until your trip
                departs. If Atlas were to fail, the bond covers repatriation and a
                refund of what you have paid. We are not an insurance intermediary
                and take no commission from any insurer we mention.
              </p>
            </div>

            <div className="card card-pad stack">
              <span className="eyebrow eyebrow-accent">Find us</span>
              <h2 style={{ fontSize: 'clamp(1.5rem, 1.2rem + 1vw, 2rem)' }}>
                One office, above a bookshop
              </h2>
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
                  <dt>Office hours</dt>
                  <dd>Mon–Fri, 09:00–18:00 CET</dd>
                </div>
                <div className="meta-item">
                  <dt>On departure</dt>
                  <dd className="mono">+389 70 442 900</dd>
                </div>
              </dl>
              <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                The emergency number is answered by a duty member of staff, not a
                call centre, twenty-four hours a day while any Atlas group is in
                the field.
              </p>
              <div className="cluster" style={{ marginTop: 'var(--s2)' }}>
                <Link className="btn btn-primary" href="/contact">
                  Send us an enquiry
                </Link>
                <Link className="btn btn-secondary" href="/tours">
                  Browse the trips
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <p className="alert alert-info">
            Atlas is a fictional tour operator, invented for a university
            coursework project. The company, the team, the licence numbers and the
            trips on this site are not real, and nothing here can be booked.
          </p>
        </div>
      </section>
    </>
  );
}
