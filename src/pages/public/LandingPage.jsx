import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Search, Calendar, Truck, CheckCircle2, MessageCircle,
  ThumbsUp, ShieldCheck, Clock, MapPin, Package, ExternalLink, HelpCircle
} from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { getTrips, getCompanyInformation } from '../../lib/database';
import { PUBLIC_PAGES } from '../../seo/publicPages';
import { formatMoney } from '../../utils/currencyInput';
import { formatPhDate, formatTripScheduleDate } from '../../utils/datetime';
import PublicBookingForm from '../../components/public/PublicBookingForm';
import PublicInquiryForm from '../../components/public/PublicInquiryForm';
import FacebookFollowModal from '../../components/public/FacebookFollowModal';
import './landing.css';

const { heading, summary } = PUBLIC_PAGES['/'];

const MESSENGER_URL = 'https://www.facebook.com/marlon.sarong.cargodeliveryservice#';
const FB_PAGE_URL = 'https://www.facebook.com/mscargodeliveryservice';

const STEPS = [
  ['Check Trip Schedules', 'See open departures and available capacity between Manila and Bohol.'],
  ['Direct Booking (No Login)', 'Enter sender, receiver, and parcel details directly from this page.'],
  ['Weighed at Pickup', 'Price is calculated from actual weighed kilograms, not a rough guess.'],
  ['Pay & Track Anywhere', 'Pay via GCash or Cash, and track real-time delivery using your CE- tracking code.'],
];

const PAGES = [
  ['/schedules', 'Trip Schedules Calendar', 'Upcoming departures, space left in kg, and rate per kilo.'],
  ['/track', 'Track Shipment', 'Track your delivery status in real-time with your tracking number.'],
  ['/faq', 'Help & Guidelines', 'Packing tips, accepted goods, pickup coverage, and FAQs.'],
  ['/about', 'About CargoExpress PH', 'Hub locations, customer feedback, and company credentials.'],
];

/** Goes to /track?q=…, which TrackingPage searches on open. */
const TrackForm = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const trackingNumber = value.trim().toUpperCase();
    navigate(trackingNumber ? `/track?q=${encodeURIComponent(trackingNumber)}` : '/track');
  };

  return (
    <form id="track-section" className="lx-track" action="/track" method="get" role="search" onSubmit={submit} style={{ scrollMarginTop: 110 }}>
      <label className="lx-track-label" htmlFor="lx-track-input">Track a shipment</label>
      <div className="lx-track-field">
        <Search size={18} className="lx-track-icon" aria-hidden="true" />
        <input
          id="lx-track-input"
          name="q"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          placeholder="CE-YYYYMMDD-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          aria-describedby="lx-track-hint"
        />
        <button type="submit" className="lx-track-submit">Track</button>
      </div>
      <p id="lx-track-hint" className="lx-track-hint">
        Enter your tracking number (CE-...). No account needed.
      </p>
    </form>
  );
};

const LandingPage = () => {
  usePageTitle();

  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [selectedTripForBooking, setSelectedTripForBooking] = useState(null);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);

  const bookingSectionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getTrips('active'), getCompanyInformation()])
      .then(([tripsRes, infoRes]) => {
        if (!mounted) return;
        if (tripsRes.status === 'fulfilled' && Array.isArray(tripsRes.value)) {
          setTrips(tripsRes.value);
        }
        if (infoRes.status === 'fulfilled' && infoRes.value) {
          setCompanyInfo(infoRes.value);
        }
      })
      .finally(() => {
        if (mounted) setTripsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (id === 'track-section') {
              const input = document.getElementById('lx-track-input');
              if (input) {
                input.focus();
                input.select();
              }
            }
          }, 150);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTrip = (trip) => {
    setSelectedTripForBooking(trip);
    if (bookingSectionRef.current) {
      bookingSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenMessenger = (e) => {
    // Open Messenger link in a new tab
    window.open(MESSENGER_URL, '_blank', 'noopener,noreferrer');
    // Trigger the friendly Facebook follow pop-up inside the app
    setIsFbModalOpen(true);
  };

  const scrollToBooking = () => {
    if (bookingSectionRef.current) {
      bookingSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="lx">
      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <section className="lx-hero" aria-labelledby="lx-hero-title">
        <picture className="lx-hero-photo" aria-hidden="true">
          <source media="(max-width: 700px)" srcSet="/images/landing-hero-sm.webp" type="image/webp" />
          <img src="/images/landing-hero.webp" alt="" width="1376" height="768" fetchPriority="high" decoding="async" />
        </picture>
        <div className="lx-hero-inner">
          <div className="lx-hero-copy">
            <p className="lx-route-line">
              Manila <span aria-hidden="true">⇄</span><span className="sr-only">and</span> Bohol Cargo Delivery
            </p>
            <h1 id="lx-hero-title">{heading}</h1>
            <p className="lx-lede">{summary}</p>

            {/* Quick Track Input */}
            <TrackForm />

            {/* Hero Quick Action Buttons */}
            <div className="lx-hero-actions">
              <button
                type="button"
                className="lx-btn lx-btn-primary"
                onClick={scrollToBooking}
                style={{ cursor: 'pointer' }}
              >
                Book a Cargo Now <ArrowRight size={16} style={{ marginLeft: 6 }} />
              </button>

              <button
                type="button"
                className="lx-btn-messenger"
                onClick={handleOpenMessenger}
                aria-label="Chat with Us on Messenger"
              >
                <MessageCircle size={18} /> Chat with Us on Messenger
              </button>
            </div>
          </div>

          {/* Next Departures Preview Card in Hero */}
          <section className="lx-board" aria-labelledby="lx-board-title">
            <header>
              <h2 id="lx-board-title">Next Departures</h2>
              <span>Open for booking</span>
            </header>

            {tripsLoading ? (
              <ul className="lx-board-rows" aria-busy="true" aria-label="Loading trips">
                {Array.from({ length: 3 }, (_, index) => <li key={index} className="lx-board-skeleton" />)}
              </ul>
            ) : trips.length === 0 ? (
              <p className="lx-board-note">No departures currently scheduled. Flexible booking is available below!</p>
            ) : (
              <ul className="lx-board-rows">
                {trips.slice(0, 4).map((trip) => {
                  const spaceLeftKg = Math.max(0, (trip.capacity || 0) - (trip.current_weight || 0));
                  return (
                    <li
                      key={trip.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectTrip(trip)}
                      title="Click to select this trip for booking"
                    >
                      <span className="lx-board-date">
                        <strong>{formatPhDate(trip.departure_date, { month: 'short', day: 'numeric', year: undefined })}</strong>
                        <span>{formatPhDate(trip.departure_date, { weekday: 'short', month: undefined, day: undefined, year: undefined })}</span>
                      </span>
                      <span className="lx-board-route">
                        {trip.origin} <ArrowRight size={13} aria-hidden="true" /><span className="sr-only">to</span> {trip.destination}
                        <span className="lx-board-trip">{trip.trip_number} · {spaceLeftKg.toLocaleString()} kg left</span>
                      </span>
                      <span className="lx-board-rate">
                        {formatMoney(parseFloat(trip.price_per_kg || 70))}<span>/kg</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={scrollToBooking}
                style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
              >
                Book with or without trip <ArrowRight size={14} />
              </button>
              <a
                href="#schedules-section"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('schedules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  window.history.replaceState(null, '', '#schedules-section');
                }}
                style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', textDecoration: 'none', cursor: 'pointer' }}
              >
                All schedules
              </a>
            </div>
          </section>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          1. AVAILABLE TRIP SCHEDULES OVERVIEW SECTION
      ══════════════════════════════════════════════════════════════════ */}
      {/* Section Divider 1 */}
      <div className="lx-section-divider">
        <div className="lx-divider-pill">
          <Calendar size={14} /> 1. Trip Schedules
        </div>
      </div>

      <section id="schedules-section" className="lx-section lx-section-box lx-section-schedules" aria-labelledby="lx-schedules-title" style={{ scrollMarginTop: 90 }}>
        <div className="lx-section-head">
          <div>
            <div className="lx-section-pill-tag">
              <span className="lx-pill-dot" /> Open Departures
            </div>
            <h2 id="lx-schedules-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px' }}>
              Available Trip Schedules Overview
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem' }}>
              Upcoming departures between Manila and Bohol. Select a trip to lock in your cargo slot or book flexibly below.
            </p>
          </div>
          <Link to="/schedules" className="lx-text-link">
            Full Schedule Calendar <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {tripsLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading available trip schedules...
          </div>
        ) : trips.length === 0 ? (
          <div className="lx-empty-trips-banner">
            <div className="lx-empty-trips-icon">
              <Calendar size={28} color="var(--primary, #16A34A)" />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700 }}>
                Flexible Sea Freight Booking Available
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)', maxWidth: 540 }}>
                No scheduled departure picked yet? You can still book your shipment right away below! Dispatch will assign it to the next upcoming trip.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={scrollToBooking} style={{ fontWeight: 700 }}>
                Book Flexible Cargo Below <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </button>
            </div>
          </div>
        ) : (
          <div className="lx-schedules-grid">
            {trips.slice(0, 6).map((trip) => {
              const spaceLeftKg = Math.max(0, (trip.capacity || 0) - (trip.current_weight || 0));
              const departureDate = formatTripScheduleDate(trip.departure_date);
              const isSelected = selectedTripForBooking?.id === trip.id;

              return (
                <div
                  key={trip.id}
                  className="lx-trip-overview-card"
                  style={{
                    borderColor: isSelected ? 'var(--primary, #0f766e)' : undefined,
                    backgroundColor: isSelected ? 'var(--primary-bg, #f0fdfa)' : undefined,
                  }}
                >
                  <div className="lx-trip-card-header">
                    <span className="lx-trip-route-badge">
                      {trip.origin} <ArrowRight size={16} color="var(--primary)" /> {trip.destination}
                    </span>
                    <span className="lx-trip-number-tag">{trip.trip_number}</span>
                  </div>

                  <div className="lx-trip-meta-list">
                    <div className="lx-trip-meta-item">
                      <Calendar size={15} color="var(--primary)" />
                      <span>
                        Departure: <strong>{departureDate.full}</strong>
                      </span>
                    </div>

                    {trip.arrival_date && (
                      <div className="lx-trip-meta-item">
                        <Clock size={15} color="var(--text-tertiary)" />
                        <span>
                          Estimated Delivery (ETA): <strong>{formatPhDate(trip.arrival_date)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="lx-trip-badges-row">
                    <span className="lx-badge-capacity">
                      <Package size={14} />
                      <strong>{spaceLeftKg.toLocaleString()} kg</strong> space left
                    </span>
                    <span className="lx-badge-rate">
                      <strong>{formatMoney(parseFloat(trip.price_per_kg || 70))}/kg</strong> rate
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ width: '100%', marginTop: 4, fontWeight: 700 }}
                    onClick={() => handleSelectTrip(trip)}
                  >
                    {isSelected ? '✓ Selected for Booking' : 'Select this Trip to Book'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. & 3. DIRECT CARGO BOOKING FORM (NO LOGIN REQUIRED)
      ══════════════════════════════════════════════════════════════════ */}
      {/* Section Divider 2 */}
      <div className="lx-section-divider">
        <div className="lx-divider-pill lx-divider-pill-emerald">
          <Truck size={14} /> 2. Direct Cargo Booking Form
        </div>
      </div>

      <section
        id="booking-section"
        ref={bookingSectionRef}
        className="lx-section lx-section-box lx-section-booking"
        aria-labelledby="lx-booking-title"
        style={{ scrollMarginTop: 80 }}
      >
        <PublicBookingForm preselectedTrip={selectedTripForBooking} />
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          MESSENGER INTEGRATION & DIRECT INQUIRY SECTION
      ══════════════════════════════════════════════════════════════════ */}
      {/* Section Divider 3 */}
      <div className="lx-section-divider">
        <div className="lx-divider-pill">
          <MessageCircle size={14} /> 3. Live Support &amp; Customer Inquiries
        </div>
      </div>

      <section className="lx-section lx-section-box lx-section-inquiry" aria-labelledby="lx-inquiry-title">
        <div className="lx-inquiry-wrapper">
          {/* Left Column: Messenger Chat & Social Connect */}
          <div className="lx-connect-card">
            <div>
              <span className="lx-section-pill-tag">
                <span className="lx-pill-dot" /> Instant Support
              </span>
              <h2 id="lx-inquiry-title" style={{ margin: '6px 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
                Need Help or Have Questions?
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Our team is always online on Facebook Messenger to answer your delivery inquiries, pickup requests, and booking questions.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Prominent Messenger Button */}
              <button
                type="button"
                className="lx-btn-messenger"
                onClick={handleOpenMessenger}
                style={{ width: '100%', padding: '16px 20px', fontSize: '1rem' }}
              >
                <MessageCircle size={22} /> Chat with Us on Messenger
              </button>

              {/* Direct Facebook Page Button */}
              <a
                href={FB_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ThumbsUp size={18} /> Like &amp; Follow Official Facebook Page <ExternalLink size={15} />
              </a>
            </div>

            {/* Direct Dispatch Phones / Hubs Info */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 16,
                borderTop: '1px solid var(--border, #e2e8f0)',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Direct Dispatch Contacts:
              </p>
              {companyInfo?.smart_phone && (
                <div>SMART / TNT: <strong>{companyInfo.smart_phone}</strong></div>
              )}
              {companyInfo?.globe_phone && (
                <div>GLOBE / TM: <strong>{companyInfo.globe_phone}</strong></div>
              )}
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Operating Hours: Monday – Saturday (8:00 AM – 6:00 PM PHT)
              </div>
            </div>
          </div>

          {/* Right Column: Direct Message / Inquiry Form */}
          <div>
            <PublicInquiryForm />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          HOW SHIPPING WORKS
      ══════════════════════════════════════════════════════════════════ */}
      {/* Section Divider 4 */}
      <div className="lx-section-divider">
        <div className="lx-divider-pill">
          <HelpCircle size={14} /> 4. Shipping Guide
        </div>
      </div>

      <section className="lx-section lx-section-box lx-section-steps" aria-labelledby="lx-steps-title">
        <div className="lx-section-head">
          <div>
            <div className="lx-section-pill-tag">
              <span className="lx-pill-dot" /> Simple 4-Step Process
            </div>
            <h2 id="lx-steps-title">How Cargo Delivery Works</h2>
          </div>
          <button type="button" onClick={scrollToBooking} className="lx-text-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>
            Book without an account <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <ol className="lx-steps">
          {STEPS.map(([title, text], index) => (
            <li key={title}>
              <span className="lx-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PAGES & RESOURCES
      ══════════════════════════════════════════════════════════════════ */}
      {/* Section Divider 5 */}
      <div className="lx-section-divider">
        <div className="lx-divider-pill">
          <ShieldCheck size={14} /> 5. Help &amp; Resources
        </div>
      </div>

      <section className="lx-section lx-section-box lx-section-more" aria-labelledby="lx-more-title">
        <h2 id="lx-more-title">Before You Book</h2>
        <ul className="lx-pages">
          {PAGES.map(([to, title, text]) => (
            <li key={to}>
              <Link to={to}>
                <span><strong>{title}</strong><span>{text}</span></span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FACEBOOK FOLLOW POP-UP MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <FacebookFollowModal
        isOpen={isFbModalOpen}
        onClose={() => setIsFbModalOpen(false)}
      />
    </div>
  );
};

export default LandingPage;
