import Link from 'next/link';
import NewsletterForm from './NewsletterForm';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Link href="/" className="brand" style={{ marginBottom: 'var(--s3)' }}>
              Atlas
              <span className="brand-mark">est. 2019</span>
            </Link>
            <p className="muted" style={{ fontSize: '0.92rem', maxWidth: '34ch' }}>
              Small-group journeys across the Mediterranean, the Balkans and
              North Africa. Sixteen travellers maximum, guided by people who
              live there.
            </p>
            <NewsletterForm />
          </div>

          <div className="footer-col">
            <h4>Travel</h4>
            <ul>
              <li><Link href="/tours">All tours</Link></li>
              <li><Link href="/destinations">Destinations</Link></li>
              <li><Link href="/deals">Deals &amp; offers</Link></li>
              <li><Link href="/search">Search</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Agency</h4>
            <ul>
              <li><Link href="/about">About Atlas</Link></li>
              <li><Link href="/blog">The Journal</Link></li>
              <li><Link href="/contact">Contact us</Link></li>
              <li><Link href="/account">My trips</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Practical</h4>
            <ul>
              <li><Link href="/legal/booking-conditions">Booking conditions</Link></li>
              <li><Link href="/legal/privacy">Privacy policy</Link></li>
              <li><Link href="/legal/cancellation">Cancellation policy</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Atlas Travel d.o.o. — a fictional agency
            built as a university project.
          </span>
          <span className="mono">Licence ATL-2019-0442 · +389 2 300 1188</span>
        </div>
      </div>
    </footer>
  );
}
