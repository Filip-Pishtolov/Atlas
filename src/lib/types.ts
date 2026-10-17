export type Role = 'customer' | 'staff' | 'admin';
export type TourStatus = 'draft' | 'published' | 'sold_out' | 'retired';
export type Difficulty = 'easy' | 'moderate' | 'challenging' | 'tough';
export type DepartureStatus = 'open' | 'guaranteed' | 'sold_out' | 'cancelled';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'cancelled'
  | 'completed';
export type PromotionType = 'percentage' | 'fixed';
export type PromotionScope = 'all' | 'tour' | 'destination' | 'theme';
export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type EnquiryStatus = 'new' | 'in_progress' | 'closed';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  phone: string | null;
  created_at: string;
}

export type PublicUser = Omit<User, 'password_hash'>;

export interface Destination {
  id: number;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  summary: string;
  description: string;
  hero_image: string;
  best_time: string | null;
  is_featured: number;
  created_at: string;
}

export interface Theme {
  id: number;
  slug: string;
  name: string;
}

export interface Tour {
  id: number;
  slug: string;
  title: string;
  destination_id: number;
  summary: string;
  description: string;
  duration_days: number;
  difficulty: Difficulty;
  group_size_min: number;
  group_size_max: number;
  base_price_cents: number;
  hero_image: string;
  meeting_point: string | null;
  status: TourStatus;
  is_featured: number;
  created_at: string;
  updated_at: string;
}

export interface TourCardData extends Tour {
  destination_name: string;
  destination_slug: string;
  country: string;
  review_count: number;
  avg_rating: number | null;
  next_departure: string | null;
  min_price_cents: number;
}

export interface TourImage {
  id: number;
  tour_id: number;
  url: string;
  alt: string;
  sort_order: number;
}

export interface ItineraryDay {
  id: number;
  tour_id: number;
  day_number: number;
  title: string;
  description: string;
  meals: string | null;
  accommodation: string | null;
}

export interface TourFact {
  id: number;
  tour_id: number;
  kind: 'included' | 'excluded';
  text: string;
  sort_order: number;
}

export interface Departure {
  id: number;
  tour_id: number;
  start_date: string;
  end_date: string;
  price_cents: number;
  seats_total: number;
  seats_booked: number;
  status: DepartureStatus;
  created_at: string;
}

export interface Promotion {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  badge_text: string | null;
  type: PromotionType;
  value: number;
  scope: PromotionScope;
  scope_id: number | null;
  starts_at: string;
  ends_at: string;
  min_booking_cents: number;
  min_travellers: number;
  min_days_before: number | null;
  max_days_before: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  priority: number;
  stackable: number;
  status: PromotionStatus;
  created_at: string;
}

export interface Booking {
  id: number;
  reference: string;
  user_id: number | null;
  tour_id: number;
  departure_id: number;
  status: BookingStatus;
  travellers_count: number;
  base_total_cents: number;
  discount_cents: number;
  total_cents: number;
  deposit_cents: number;
  promotion_id: number | null;
  promo_code: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingTraveller {
  id: number;
  booking_id: number;
  full_name: string;
  dob: string | null;
  nationality: string | null;
  dietary: string | null;
  is_lead: number;
}

export interface Review {
  id: number;
  tour_id: number;
  user_id: number | null;
  booking_id: number | null;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  created_at: string;
}

export interface Enquiry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  tour_id: number | null;
  subject: string;
  message: string;
  status: EnquiryStatus;
  created_at: string;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  hero_image: string;
  author_id: number | null;
  author_name: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
}
