import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Deposits, balances, cancellation charges, group sizes, difficulty grades, solo travel, insurance and visas — the twelve questions the Atlas office answers most often.',
};

interface Faq {
  group: string;
  question: string;
  answer: string;
}

const FAQS: Faq[] = [
  {
    group: 'Booking',
    question: 'How do I book, and when is my place actually confirmed?',
    answer:
      'Pick a departure on the tour page and complete the booking form. Your place is held the moment the booking is created and confirmed once the 20% deposit reaches us, normally within a working day. You will get a booking reference beginning ATL and a confirmation listing the departure, the price you agreed and what is included. That confirmation is the contract — if anything in it does not match what you expected, tell us before you pay the balance.',
  },
  {
    group: 'Booking',
    question: 'When does a departure become guaranteed?',
    answer:
      'At six travellers. Once a departure reaches six confirmed bookings we mark it guaranteed and it runs, even if people cancel afterwards and even when it stops making money for us. That is the point at which we would book flights ourselves. Departures still showing as open may run — most do — but they are not yet a promise.',
  },
  {
    group: 'Booking',
    question: 'What happens if a departure does not reach minimum numbers?',
    answer:
      'We tell you no later than 45 days before departure, by phone rather than by email. You can move to another date at the price you originally paid, move to a different trip and pay or receive the difference, or take a full refund of everything you have paid us within fourteen days. We do not offer credit notes instead of refunds.',
  },
  {
    group: 'Payment',
    question: 'How much is the deposit, and when is the balance due?',
    answer:
      'The deposit is 20% of the total, rounded to whole euros, and it is shown to you before you confirm anything. The balance is due 60 days before departure. If you book inside 60 days, the full amount is payable at the time of booking. We send a reminder ten days before the balance date; if a balance is more than fourteen days late we may treat the booking as cancelled under the standard scale.',
  },
  {
    group: 'Payment',
    question: 'Can the price change after I have booked?',
    answer:
      'Only downwards, in practice. We reserve the right to pass on increases in transport costs, fuel, or taxes and fees, but only up to 8% of the trip price and never within 20 days of departure, and we absorb the first 2% ourselves. Any increase above 8% gives you the right to cancel with a full refund. In six years we have applied a surcharge once, in 2022, and it was 3.1%.',
  },
  {
    group: 'Payment',
    question: 'Do discount codes stack with the offers already showing?',
    answer:
      'No, and that is deliberate. When several offers could apply to one booking, our pricing engine works out what each one is worth and applies the single one that saves you the most money. If you type a code and the total does not move, it is because an automatic discount already on your booking was worth more. Nobody is ever charged more for using a code.',
  },
  {
    group: 'Cancellations',
    question: 'What happens if I have to cancel?',
    answer:
      'Tell us in writing and the charge is set by the date we receive it: more than 60 days before departure you lose the deposit only; 60 to 31 days is 50% of the total; 30 to 15 days is 75%; 14 days or fewer, or not turning up, is 100%. The full scale, with worked examples, is on our cancellation policy page. Most reasons people cancel for are covered by a decent insurance policy, which is why we insist you have one.',
  },
  {
    group: 'Cancellations',
    question: 'Can I transfer my booking to someone else?',
    answer:
      'Yes. Up to 7 days before departure you can transfer your place to anyone who meets the requirements of the trip, for a €40 administration fee plus whatever our suppliers charge us to change a name — usually nothing on our own trips, occasionally more where internal flights or permits are involved. You and the person taking your place are jointly responsible for any outstanding balance.',
  },
  {
    group: 'On the trip',
    question: 'How big are the groups, honestly?',
    answer:
      'Sixteen is the absolute ceiling and we do not make exceptions for a couple who asked nicely. In practice our average departure last year carried eleven travellers. Walking trips in the Balkans usually cap at twelve, and a few routes where the guesthouses are genuinely small cap at ten. The number on each tour page is the real maximum for that trip, not a marketing figure.',
  },
  {
    group: 'On the trip',
    question: 'What do the difficulty grades actually mean?',
    answer:
      'Easy means up to three hours of walking on good paths with a vehicle never far away. Moderate means four to six hours a day, some ascent, and consecutive walking days. Challenging means six to eight hours, real ascent and descent, and occasional rough or exposed ground. Tough means long days at altitude or in remote terrain where turning back takes hours. Every tour page states the daily walking hours and ascent — read those before the grade.',
  },
  {
    group: 'Travelling solo',
    question: 'Can I travel on my own, and will I be charged a single supplement?',
    answer:
      'About four in ten Atlas travellers book alone, so you will not be the only one. Solo travellers are paired in a twin room with someone of the same gender at no extra cost, and if we cannot pair you we give you the single room anyway and do not charge for it. If you would rather have your own room from the start, the single supplement is shown on each tour page and is typically €25 to €60 a night.',
  },
  {
    group: 'Insurance and paperwork',
    question: 'Do I need travel insurance, and what about visas and vaccinations?',
    answer:
      'Insurance covering medical treatment, repatriation and cancellation is a condition of booking, and we ask for your policy number 60 days before departure. We are not insurance intermediaries, we sell no policies and we take no commission from anyone who does. Passports, visas and health requirements are your responsibility: we tell you what applies to the nationalities on your booking and link to the official government source, but we cannot apply on your behalf and a refused visa is treated as a cancellation.',
  },
];

const GROUPS = ['Booking', 'Payment', 'Cancellations', 'On the trip', 'Travelling solo', 'Insurance and paperwork'];

export default async function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'FAQ' }]} />
          <span className="eyebrow eyebrow-accent">Frequently asked</span>
          <h1>The twelve questions we answer every week</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Written out properly, with the numbers in them. If your question is
            not here, the office answers email within one working day and the
            phone within about four rings.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <div className="stack stack-lg">
            {GROUPS.map((group) => {
              const items = FAQS.filter((faq) => faq.group === group);
              if (items.length === 0) return null;

              return (
                <div key={group}>
                  <div className="section-head section-head-line" style={{ marginBottom: 'var(--s4)' }}>
                    <div>
                      <span className="eyebrow" style={{ margin: 0 }}>
                        {group}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {items.length} {items.length === 1 ? 'question' : 'questions'}
                    </span>
                  </div>

                  <div className="stack stack-sm">
                    {items.map((faq) => (
                      <details
                        key={faq.question}
                        className="card"
                        style={{ padding: 'var(--s4) var(--s5)' }}
                      >
                        <summary
                          style={{
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: 'var(--ink)',
                            listStylePosition: 'outside',
                          }}
                        >
                          {faq.question}
                        </summary>
                        <p
                          className="muted"
                          style={{ margin: 'var(--s3) 0 0', fontSize: '0.95rem' }}
                        >
                          {faq.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-narrow">
          <div className="card card-pad between">
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Still stuck?
              </span>
              <p style={{ margin: '4px 0 0', maxWidth: '44ch' }} className="muted">
                Ask us directly. We would rather answer a long list of questions
                now than sort out a mismatch on day two of your trip.
              </p>
            </div>
            <div className="cluster">
              <Link className="btn btn-primary" href="/contact">
                Ask a question
              </Link>
              <Link className="btn btn-secondary" href="/legal/booking-conditions">
                Booking conditions
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
