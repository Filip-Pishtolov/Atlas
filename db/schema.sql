PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','staff','admin')),
  phone         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE destinations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  country     TEXT    NOT NULL,
  region      TEXT,
  summary     TEXT    NOT NULL,
  description TEXT    NOT NULL,
  hero_image  TEXT    NOT NULL,
  best_time   TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE themes (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT    NOT NULL UNIQUE,
  name TEXT    NOT NULL
);

CREATE TABLE tours (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT    NOT NULL UNIQUE,
  title            TEXT    NOT NULL,
  destination_id   INTEGER NOT NULL REFERENCES destinations(id),
  summary          TEXT    NOT NULL,
  description      TEXT    NOT NULL,
  duration_days    INTEGER NOT NULL,
  difficulty       TEXT    NOT NULL DEFAULT 'moderate'
                   CHECK (difficulty IN ('easy','moderate','challenging','tough')),
  group_size_min   INTEGER NOT NULL DEFAULT 2,
  group_size_max   INTEGER NOT NULL DEFAULT 16,
  base_price_cents INTEGER NOT NULL,
  hero_image       TEXT    NOT NULL,
  meeting_point    TEXT,
  status           TEXT    NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','sold_out','retired')),
  is_featured      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tours_destination ON tours(destination_id);
CREATE INDEX idx_tours_status ON tours(status);

CREATE TABLE tour_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id    INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  url        TEXT    NOT NULL,
  alt        TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tour_images_tour ON tour_images(tour_id);

CREATE TABLE tour_themes (
  tour_id  INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, theme_id)
);

CREATE TABLE itinerary_days (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id       INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL,
  title         TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  meals         TEXT,
  accommodation TEXT
);
CREATE INDEX idx_itinerary_tour ON itinerary_days(tour_id);

CREATE TABLE tour_facts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id    INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL CHECK (kind IN ('included','excluded')),
  text       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tour_facts_tour ON tour_facts(tour_id);

CREATE TABLE departures (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id      INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  start_date   TEXT    NOT NULL,
  end_date     TEXT    NOT NULL,
  price_cents  INTEGER NOT NULL,
  seats_total  INTEGER NOT NULL DEFAULT 16,
  seats_booked INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','guaranteed','sold_out','cancelled')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_departures_tour ON departures(tour_id);
CREATE INDEX idx_departures_date ON departures(start_date);

CREATE TABLE promotions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  code               TEXT    UNIQUE,
  description        TEXT,
  badge_text         TEXT,
  type               TEXT    NOT NULL CHECK (type IN ('percentage','fixed')),
  value              INTEGER NOT NULL,
  scope              TEXT    NOT NULL DEFAULT 'all'
                     CHECK (scope IN ('all','tour','destination','theme')),
  scope_id           INTEGER,
  starts_at          TEXT    NOT NULL,
  ends_at            TEXT    NOT NULL,
  min_booking_cents  INTEGER NOT NULL DEFAULT 0,
  min_travellers     INTEGER NOT NULL DEFAULT 1,
  min_days_before    INTEGER,
  max_days_before    INTEGER,
  usage_limit        INTEGER,
  usage_count        INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER,
  priority           INTEGER NOT NULL DEFAULT 0,
  stackable          INTEGER NOT NULL DEFAULT 0,
  status             TEXT    NOT NULL DEFAULT 'active'
                     CHECK (status IN ('draft','active','paused','expired')),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_code ON promotions(code);

CREATE TABLE price_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id      INTEGER REFERENCES tours(id) ON DELETE CASCADE,
  departure_id INTEGER REFERENCES departures(id) ON DELETE CASCADE,
  price_cents  INTEGER NOT NULL,
  changed_by   INTEGER REFERENCES users(id),
  changed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bookings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reference        TEXT    NOT NULL UNIQUE,
  user_id          INTEGER REFERENCES users(id),
  tour_id          INTEGER NOT NULL REFERENCES tours(id),
  departure_id     INTEGER NOT NULL REFERENCES departures(id),
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','paid','cancelled','completed')),
  travellers_count INTEGER NOT NULL,
  base_total_cents INTEGER NOT NULL,
  discount_cents   INTEGER NOT NULL DEFAULT 0,
  total_cents      INTEGER NOT NULL,
  deposit_cents    INTEGER NOT NULL DEFAULT 0,
  promotion_id     INTEGER REFERENCES promotions(id),
  promo_code       TEXT,
  contact_name     TEXT    NOT NULL,
  contact_email    TEXT    NOT NULL,
  contact_phone    TEXT,
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_departure ON bookings(departure_id);

CREATE TABLE booking_travellers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name   TEXT    NOT NULL,
  dob         TEXT,
  nationality TEXT,
  dietary     TEXT,
  is_lead     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_travellers_booking ON booking_travellers(booking_id);

CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id     INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  booking_id  INTEGER REFERENCES bookings(id),
  author_name TEXT    NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reviews_tour ON reviews(tour_id);

CREATE TABLE enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  phone      TEXT,
  tour_id    INTEGER REFERENCES tours(id),
  subject    TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'new'
             CHECK (status IN ('new','in_progress','closed')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE blog_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  excerpt      TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  hero_image   TEXT    NOT NULL,
  author_id    INTEGER REFERENCES users(id),
  author_name  TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','published')),
  published_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE newsletter_subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  actor_name TEXT,
  action     TEXT    NOT NULL,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
