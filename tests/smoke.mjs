import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const db = new DatabaseSync(path.join(process.cwd(), 'data', 'atlas.db'));

const tour = db.prepare("SELECT slug, id FROM tours WHERE status='published' ORDER BY id LIMIT 1").get();
const dest = db.prepare('SELECT slug FROM destinations ORDER BY id LIMIT 1').get();
const post = db.prepare("SELECT slug FROM blog_posts WHERE status='published' LIMIT 1").get();
const dep = db.prepare(
  "SELECT d.id, d.tour_id, d.price_cents, d.seats_total, d.seats_booked FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.status='published' AND d.start_date > '2026-10-01' AND d.status IN ('open','guaranteed') AND d.seats_total - d.seats_booked >= 3 ORDER BY d.start_date LIMIT 1",
).get();
const booking = db.prepare("SELECT b.reference FROM bookings b JOIN users u ON u.id = b.user_id WHERE u.email = 'maria@example.com' ORDER BY b.id LIMIT 1").get();

let pass = 0, fail = 0;
const failures = [];

function record(ok, name, detail) {
  if (ok) { pass++; }
  else { fail++; failures.push(`${name} :: ${detail}`); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`);
}

async function page(path, mustInclude = [], expect = 200) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    if (res.status !== expect) {
      return record(false, `GET ${path}`, `status ${res.status} (wanted ${expect})`);
    }
    if (expect >= 300 && expect < 400) return record(true, `GET ${path}`, '');
    const html = await res.text();
    const missing = mustInclude.filter((s) => !html.includes(s));
    if (missing.length) {
      return record(false, `GET ${path}`, `missing text: ${JSON.stringify(missing)}`);
    }
    if (/Application error|Internal Server Error|Unhandled Runtime/i.test(html)) {
      return record(false, `GET ${path}`, 'error page rendered');
    }
    record(true, `GET ${path}`, '');
  } catch (e) {
    record(false, `GET ${path}`, e.message);
  }
}

console.log('--- PUBLIC PAGES ---');
await page('/', ['Atlas', 'From']);
await page('/tours', ['tours']);
await page(`/tours/${tour.slug}`, ['Day by day', 'What your money covers', 'Dates and prices']);
await page('/destinations', ['Destinations']);
await page(`/destinations/${dest.slug}`, []);
await page('/deals', ['ATLAS25']);
await page('/blog', []);
await page(`/blog/${post.slug}`, []);
await page('/about', ['Atlas']);
await page('/contact', ['Contact']);
await page('/faq', []);
await page('/search?q=morocco', []);
await page('/legal/booking-conditions', []);
await page('/legal/privacy', []);
await page('/legal/cancellation', []);
await page('/login', ['admin@atlas.travel']);
await page('/register', []);
await page(`/book/${dep.id}`, []);
await page('/this-page-does-not-exist', [], 404);

console.log('\n--- AUTH GATES (expect redirect) ---');
await page('/account', [], 307);
await page('/admin', [], 307);

console.log('\n--- PUBLIC API ---');

let r = await fetch(BASE + '/api/promotions/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tour_id: dep.tour_id, departure_id: dep.id, travellers: 2 }),
});
let auto = await r.json();
record(r.ok, 'POST /api/promotions/validate (no code)', JSON.stringify(auto).slice(0, 200));
record(
  auto.discountCents > 0,
  'automatic promotion applies with no code',
  `discountCents=${auto.discountCents} promo=${auto.promotionName}`,
);
record(
  auto.totalCents === auto.baseTotalCents - auto.discountCents,
  'total = base - discount',
  JSON.stringify(auto),
);

r = await fetch(BASE + '/api/promotions/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tour_id: dep.tour_id, departure_id: dep.id, travellers: 2, code: 'NOPE123' }),
});
const bad = await r.json();
record(r.ok && bad.codeRejected === true, 'bad promo code -> codeRejected', JSON.stringify(bad).slice(0, 160));

r = await fetch(BASE + '/api/promotions/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tour_id: dep.tour_id, departure_id: dep.id, travellers: 4, code: 'GROUP4' }),
});
const good = await r.json();
record(r.ok && good.codeRejected === false, 'GROUP4 code accepted at 4 travellers', JSON.stringify(good).slice(0, 160));

r = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria@example.com', password: 'atlas123' }),
});
const loginBody = await r.json();
const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
record(r.ok && cookie.startsWith('atlas_session='), 'POST /api/auth/login', JSON.stringify(loginBody).slice(0, 160));
record(!JSON.stringify(loginBody).includes('password_hash'), 'login response has no password hash', '');

r = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria@example.com', password: 'wrongpass' }),
});
record(r.status === 401, 'login rejects wrong password', `status ${r.status}`);

r = await fetch(BASE + '/account', { headers: { cookie } });
const acctHtml = await r.text();
record(r.status === 200 && acctHtml.includes(booking.reference), 'GET /account signed in shows booking', `status ${r.status}`);

r = await fetch(BASE + `/account/${booking.reference}`, { headers: { cookie } });
record(r.status === 200, `GET /account/${booking.reference}`, `status ${r.status}`);

const seatsBefore = db.prepare('SELECT seats_booked FROM departures WHERE id=?').get(dep.id).seats_booked;
r = await fetch(BASE + '/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({
    departure_id: dep.id,
    travellers: [{ full_name: 'Test Traveller One' }, { full_name: 'Test Traveller Two' }],
    contact_name: 'Test Traveller One',
    contact_email: 'test@example.com',
    contact_phone: '+38970000000',
  }),
});
const made = await r.json();
record(r.status === 201 && !!made.reference, 'POST /api/bookings creates booking', JSON.stringify(made).slice(0, 200));

if (made.reference) {
  const seatsAfter = db.prepare('SELECT seats_booked FROM departures WHERE id=?').get(dep.id).seats_booked;
  record(seatsAfter === seatsBefore + 2, 'booking decrements seats', `${seatsBefore} -> ${seatsAfter}`);
  const row = db.prepare('SELECT * FROM bookings WHERE reference=?').get(made.reference);
  record(
    row.total_cents === row.base_total_cents - row.discount_cents,
    'stored booking totals are consistent',
    JSON.stringify({ b: row.base_total_cents, d: row.discount_cents, t: row.total_cents }),
  );
  record(row.deposit_cents > 0, 'deposit stored', String(row.deposit_cents));
  await page(`/book/confirmation/${made.reference}`, [made.reference]);
}

r = await fetch(BASE + '/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    departure_id: dep.id,
    total_cents: 1,
    travellers: [{ full_name: 'Cheapskate Test' }],
    contact_name: 'Cheapskate Test',
    contact_email: 'cheap@example.com',
  }),
});
const cheap = await r.json();
if (r.status === 201) {
  const row = db.prepare('SELECT total_cents FROM bookings WHERE reference=?').get(cheap.reference);
  record(row.total_cents > 1000, 'client-sent total is ignored', `stored ${row.total_cents}`);
} else {
  record(false, 'client-sent total is ignored', `booking rejected: ${JSON.stringify(cheap)}`);
}

console.log('\n--- ADMIN ---');
r = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@atlas.travel', password: 'atlas123' }),
});
const adminCookie = (r.headers.get('set-cookie') || '').split(';')[0];
record(r.ok, 'admin login', String(r.status));

r = await fetch(BASE + '/api/admin/promotions', { headers: { cookie } });
record(r.status === 401, 'admin API rejects a customer session', `status ${r.status}`);

r = await fetch(BASE + '/api/admin/promotions');
record(r.status === 401, 'admin API rejects anonymous', `status ${r.status}`);

for (const p of [
  '/admin', '/admin/tours', '/admin/tours/new', '/admin/departures',
  '/admin/promotions', '/admin/promotions/new', '/admin/bookings',
  '/admin/enquiries', '/admin/reviews', '/admin/destinations', '/admin/blog',
]) {
  const res = await fetch(BASE + p, { headers: { cookie: adminCookie }, redirect: 'manual' });
  const html = res.status === 200 ? await res.text() : '';
  record(
    res.status === 200 && !/Application error|Internal Server Error/i.test(html),
    `GET ${p} (admin)`,
    `status ${res.status}`,
  );
}

const firstTourId = db.prepare('SELECT id FROM tours ORDER BY id LIMIT 1').get().id;
const firstPromoId = db.prepare('SELECT id FROM promotions ORDER BY id LIMIT 1').get().id;
const firstBookingId = db.prepare('SELECT id FROM bookings ORDER BY id LIMIT 1').get().id;
for (const p of [`/admin/tours/${firstTourId}`, `/admin/promotions/${firstPromoId}`, `/admin/bookings/${firstBookingId}`]) {
  const res = await fetch(BASE + p, { headers: { cookie: adminCookie }, redirect: 'manual' });
  const html = res.status === 200 ? await res.text() : '';
  record(res.status === 200 && !/Application error/i.test(html), `GET ${p} (admin)`, `status ${res.status}`);
}

r = await fetch(BASE + '/api/admin/promotions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie: adminCookie },
  body: JSON.stringify({
    name: 'Smoke Test Flash Sale',
    code: '',
    description: 'Created by the smoke test.',
    badge_text: '-40%',
    type: 'percentage',
    value: 40,
    scope: 'tour',
    scope_id: dep.tour_id,
    starts_at: '2026-01-01 00:00:00',
    ends_at: '2027-12-31 23:59:59',
    priority: 999,
    status: 'active',
  }),
});
const createdPromo = await r.json();
record(r.status === 201 || r.status === 200, 'admin creates a promotion', JSON.stringify(createdPromo).slice(0, 200));

const newId = createdPromo.id ?? createdPromo.promotion?.id ?? createdPromo.item?.id;
if (newId) {
  const v = await (await fetch(BASE + '/api/promotions/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tour_id: dep.tour_id, departure_id: dep.id, travellers: 1 }),
  })).json();
  record(
    v.discountCents > auto.discountCents / 2,
    'new automatic promotion immediately affects public price',
    `promo=${v.promotionName} discount=${v.discountCents}`,
  );
  const del = await fetch(BASE + `/api/admin/promotions/${newId}`, {
    method: 'DELETE',
    headers: { cookie: adminCookie },
  });
  record(del.ok, 'admin deletes the promotion', `status ${del.status}`);
}

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
if (failures.length) {
  console.log('\nFAILURES:');
  failures.forEach((f) => console.log('  - ' + f));
}

process.exit(fail > 0 ? 1 : 0);
