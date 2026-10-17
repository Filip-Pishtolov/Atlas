# Atlas — Tourism Agency Website

A full-stack website for **Atlas**, a fictional small-group tour operator. Built as a
university project: a public marketing and booking site, a customer account area, and a
staff admin panel, all backed by a real database.

> Atlas is not a real company. No real payments are taken anywhere in this project.

---

## Running it

You need **Node.js 22 or newer** (the project uses Node's built-in SQLite driver, so there
is nothing to compile and no database server to install).

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

To wipe the database and start again from fresh seed data:

```bash
npm run reset
```

**Stop the dev server first.** Windows keeps the SQLite file locked while the server is
running, so a reset attempted alongside `npm run dev` fails with `EBUSY`.

### Tests

With the dev server running, in a second terminal:

```bash
npm run test:smoke
```

`tests/smoke.mjs` walks the whole application over HTTP: every public page, the auth
redirect gates, the promotions API (automatic discount, rejected code, accepted code),
a real booking through `POST /api/bookings` — checking that seats decrement, that totals
are consistent and that a client-supplied total is ignored — then signs in as the admin and
loads every back-office screen, creates a promotion, confirms it changes the public price
immediately, and deletes it again. 57 assertions.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@atlas.travel` | `atlas123` |
| Staff | `sara@atlas.travel` | `atlas123` |
| Customer | `maria@example.com` | `atlas123` |

The admin panel is at **/admin** and is only reachable by the admin and staff accounts.

---

## What is in it

### Public site

| Route | Purpose |
|---|---|
| `/` | Homepage: hero search, featured tours, destinations, live offers, reviews |
| `/tours` | Tour catalogue with URL-driven filters, sorting and pagination |
| `/tours/[slug]` | Tour detail: gallery, day-by-day itinerary, inclusions, departures, reviews |
| `/destinations`, `/destinations/[slug]` | Destination hubs |
| `/deals` | Every live promotion, plus the departures currently discounted |
| `/book/[departureId]` | Three-step booking form with a live price panel |
| `/book/confirmation/[reference]` | Booking confirmation |
| `/account`, `/account/[reference]` | Customer's own trips |
| `/blog`, `/blog/[slug]` | Travel journal |
| `/about`, `/contact`, `/faq`, `/search` | Agency and support pages |
| `/legal/*` | Booking conditions, privacy, cancellation policy |

### Admin panel

| Route | Purpose |
|---|---|
| `/admin` | Dashboard: KPIs, departures needing attention, recent bookings |
| `/admin/tours` | Tour catalogue management with a three-tab editor and itinerary builder |
| `/admin/departures` | Dates, prices and seat capacity |
| `/admin/promotions` | Create and manage every kind of offer |
| `/admin/bookings` | Booking list, detail and passenger manifest |
| `/admin/enquiries` | Contact form inbox |
| `/admin/reviews` | Review moderation queue |
| `/admin/destinations`, `/admin/blog` | Content management |

---

## How promotions work

This is the most interesting part of the project, so it is worth reading before the code.

**A promotion is a rule, never a hand-edited price.** Staff never type a discounted number
over the original one. The base price stays in the database and the effective price is
*computed at read time* by `src/lib/pricing.ts`. That single decision is what makes the
rest possible:

- an honest "was €1,299 / now €1,104" can be shown, because the "was" is still real
- a sale ends by itself when its end date passes — nobody has to remember to undo it
- the same offer can be reported on, because it was never baked into the price

### The three layers

1. **Merchandising** — `tours.is_featured` and badges. Placement changes, price does not.
2. **Automatic price promotions** — a `promotions` row with `code IS NULL`. The customer
   sees a lower price with no code to type. This covers seasonal sales, destination sales,
   early-bird (`min_days_before`) and last-minute (`max_days_before`).
3. **Promo codes** — a `promotions` row with a `code`. Applied at checkout.

### Conflict resolution

When several promotions match one booking, the engine picks **the one worth the most money
to the customer**, breaking ties by `priority`. Percentage discounts are deliberately never
stacked, because 20% + 20% is 36% and no member of staff expects that number.

### Where a promotion shows up

Creating one row in `/admin/promotions` makes it appear automatically on the tour card
badge, the tour detail price, the `/deals` page, the departure table and the live price
panel in the booking form. No developer is involved — which is the entire point of having
an admin panel.

---

## Architecture

```
db/
  schema.sql          Complete database schema, commented
  seed.mjs            Seed data: destinations, tours, itineraries, promotions, bookings
src/
  lib/
    db.ts             node:sqlite wrapper — query / get / run / transaction
    types.ts          TypeScript row types mirroring the schema
    queries.ts        Shared read queries (tour cards, filters, aggregates)
    pricing.ts        The promotions engine
    money.ts          Integer-cent money handling and formatting
    auth.ts           scrypt password hashing, sessions, role checks, audit log
  components/         Shared UI, plus admin/ for back-office widgets
  app/
    (site)/           Public pages (route group — shares the header/footer layout)
    admin/            Staff panel, gated in its layout
    api/              REST API: public endpoints + /api/admin/* CRUD
```

### Notable decisions

**Database.** `node:sqlite`, built into Node 22+. No `better-sqlite3`, no native compile
step, no Postgres to install — `npm install` cannot fail on a marker's machine.

**Money.** Stored as integer euro cents. Every money column ends in `_cents`, so the unit
is never ambiguous, and `0.1 + 0.2 !== 0.3` never reaches a booking total.

**Passwords.** Hashed with `scrypt` from Node's standard library, salted per user, compared
with `timingSafeEqual`. Plaintext passwords are never stored or logged.

**Sessions.** Opaque random session IDs in an `httpOnly` cookie, with the session row in
the database so it can be revoked server-side. Not a JWT — revocation matters more than
statelessness here.

**Authorisation.** The admin panel is gated in `src/app/admin/layout.tsx`, and *every*
admin API route independently calls `requireRole('admin','staff')`. UI gating alone is not
security.

**Seats.** Booking decrements `departures.seats_booked` inside a transaction and marks the
departure sold out when it fills. Cancelling a booking releases the seats again.

**Scarcity.** "Only 3 seats left" is rendered from the real `seats_remaining` value and
nothing else. There are no fake countdowns.

---

## Deploying it

`render.yaml` in the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec),
so the free tier can host this with no manual configuration:

1. Sign in at [render.com](https://render.com) with the GitHub account that owns this repo.
2. **New → Blueprint**, pick the `Atlas` repository, apply.
3. Wait for the first build (a few minutes), then open the `onrender.com` URL.

If you would rather configure it by hand, the settings are:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm run start:demo` |
| `NODE_VERSION` | `22` |

The free plan gives an **ephemeral disk** that is wiped on every restart, which would
normally destroy a SQLite database. `npm run start:demo` turns that into a feature by
reseeding at boot: the demo is always populated and testers cannot permanently break it.

Free instances also **sleep after about 15 minutes of inactivity**, so the first request
after a quiet period takes 30–60 seconds while the service wakes up.

### Sharing it temporarily instead

To let people test the site running on your own machine, without deploying:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

That prints a public HTTPS URL which stays live only while your machine, the server and
the tunnel are all running. Serve the **production** build for this (`npm run build` then
`npm start`) — the dev server refuses to send its client bundles to an unfamiliar origin,
so a tunnelled dev server renders pages that are completely unclickable.

## Images

Photography is served from `picsum.photos` using stable per-record seeds, so every image
resolves without an API key. To use real photographs, replace the `hero_image` and
`tour_images.url` values — the templates do not care where the URLs point.

An internet connection is needed for images and web fonts. Everything else, including the
database, runs entirely offline.
