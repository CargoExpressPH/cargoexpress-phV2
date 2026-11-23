import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, Truck, User, MapPin, Calendar, Clock, Check, Copy, ArrowRight,
  AlertCircle, Loader, CheckCircle2, ChevronRight, Info, ShieldCheck, DollarSign
} from 'lucide-react';
import { getTrips, createOrder, getSettings } from '../../lib/database';
import { ROUTES, PH_LOCATIONS, VALID_PROVINCES, detectPickupLocation, validateRouteProvinces } from '../../constants/phLocations';
import { formatPhDate } from '../../utils/datetime';
import { formatMoney } from '../../utils/currencyInput';
import { normalizeName } from '../../utils/string';
import { validatePhone } from '../../utils/phone';
import { useToast } from '../../hooks/useToast';
import CustomSelect from '../ui/CustomSelect';
import BarangaySelect from '../ui/BarangaySelect';

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* clipboard permission fallback */ }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const copied = document.execCommand('copy');
    el.remove();
    return copied;
  } catch {
    return false;
  }
}

const emptyForm = (initialRoute = 'Manila to Bohol', initialTripId = '') => ({
  route: initialRoute,
  tripSelectionMode: initialTripId ? 'scheduled' : 'flexible', // 'scheduled' | 'flexible'
  trip_id: initialTripId || '',
  sender_first_name: '',
  sender_middle_name: '',
  sender_last_name: '',
  sender_phone: '',
  sender_facebook: '',
  sender_province: 'Metro Manila',
  sender_other_province: '',
  sender_city: '',
  sender_barangay: '',
  sender_street: '',
  sender_lot_block: '',
  sender_landmark: '',
  receiver_first_name: '',
  receiver_middle_name: '',
  receiver_last_name: '',
  receiver_phone: '',
  receiver_facebook: '',
  receiver_province: 'Bohol',
  receiver_city: '',
  receiver_barangay: '',
  receiver_street: '',
  receiver_lot_block: '',
  receiver_landmark: '',
  package_description: '',
  package_quantity: 1,
  payer_type: 'sender', // 'sender' | 'receiver'
  payment_preference: 'unspecified', // 'unspecified' | 'cash' | 'gcash'
  notes: '',
});

const PublicBookingForm = ({ preselectedTrip = null, onBookingComplete = null }) => {
  const toast = useToast();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [pricePerKg, setPricePerKg] = useState(70);

  const [form, setForm] = useState(() => {
    const route = preselectedTrip
      ? `${preselectedTrip.origin} to ${preselectedTrip.destination}`
      : 'Manila to Bohol';
    return emptyForm(route, preselectedTrip?.id || '');
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [copied, setCopied] = useState(false);
  const successRef = useRef(null);

  // Load active trips and rate
  useEffect(() => {
    let mounted = true;
    setTripsLoading(true);

    Promise.allSettled([getTrips('active'), getSettings()])
      .then(([tripsRes, settingsRes]) => {
        if (!mounted) return;
        if (tripsRes.status === 'fulfilled' && Array.isArray(tripsRes.value)) {
          setTrips(tripsRes.value);
        }
        if (settingsRes.status === 'fulfilled' && settingsRes.value?.price_per_kilo) {
          setPricePerKg(parseFloat(settingsRes.value.price_per_kilo) || 70);
        }
      })
      .finally(() => {
        if (mounted) setTripsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  // Sync when preselectedTrip changes from parent
  useEffect(() => {
    if (preselectedTrip) {
      const routeStr = `${preselectedTrip.origin} to ${preselectedTrip.destination}`;
      setForm((prev) => ({
        ...prev,
        route: routeStr,
        tripSelectionMode: 'scheduled',
        trip_id: preselectedTrip.id,
        sender_province: preselectedTrip.origin === 'Bohol' ? 'Bohol' : 'Metro Manila',
        receiver_province: preselectedTrip.destination === 'Bohol' ? 'Bohol' : 'Metro Manila',
        sender_city: '',
        sender_barangay: '',
        receiver_city: '',
        receiver_barangay: '',
      }));
    }
  }, [preselectedTrip]);

  const selectedRouteObj = useMemo(() => {
    if (form.route.includes('Bohol to Manila') || form.route === 'Bohol → Manila') {
      return { origin: 'Bohol', destination: 'Manila' };
    }
    return { origin: 'Manila', destination: 'Bohol' };
  }, [form.route]);

  // Filter trips for selected route
  const availableRouteTrips = useMemo(() => {
    return trips.filter(
      (t) => t.origin === selectedRouteObj.origin && t.destination === selectedRouteObj.destination
    );
  }, [trips, selectedRouteObj]);

  const selectedTrip = useMemo(() => {
    if (form.tripSelectionMode !== 'scheduled' || !form.trip_id) return null;
    return trips.find((t) => t.id === form.trip_id) || null;
  }, [trips, form.tripSelectionMode, form.trip_id]);

  // Province dropdown options
  const senderProvinces = useMemo(() => {
    if (selectedRouteObj.origin === 'Bohol') return ['Bohol'];
    return ['Metro Manila', 'Cavite', 'Batangas', 'Laguna', 'Bulacan', 'Other Area'];
  }, [selectedRouteObj.origin]);

  const receiverProvinces = useMemo(() => {
    if (selectedRouteObj.destination === 'Bohol') return ['Bohol'];
    return ['Metro Manila', 'Cavite', 'Batangas', 'Laguna', 'Bulacan'];
  }, [selectedRouteObj.destination]);

  const senderCities = useMemo(() => {
    if (form.sender_province === 'Other Area') return [];
    return PH_LOCATIONS[form.sender_province] || [];
  }, [form.sender_province]);

  const receiverCities = useMemo(() => {
    return PH_LOCATIONS[form.receiver_province] || [];
  }, [form.receiver_province]);

  const handleRouteChange = (newRoute) => {
    const isBoholToManila = newRoute.includes('Bohol to Manila') || newRoute === 'Bohol → Manila';
    setForm((prev) => ({
      ...prev,
      route: newRoute,
      trip_id: '',
      sender_province: isBoholToManila ? 'Bohol' : 'Metro Manila',
      sender_other_province: '',
      sender_city: '',
      sender_barangay: '',
      receiver_province: isBoholToManila ? 'Metro Manila' : 'Bohol',
      receiver_city: '',
      receiver_barangay: '',
    }));
    setFieldErrors({});
  };

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handlePhoneInput = (field, raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    updateField(field, digits);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};

    if (!form.sender_first_name.trim()) errors.sender_first_name = 'First name is required.';
    if (!form.sender_last_name.trim()) errors.sender_last_name = 'Last name is required.';
    const senderPhoneErr = validatePhone(form.sender_phone);
    if (senderPhoneErr) errors.sender_phone = senderPhoneErr;
    if (!form.sender_facebook.trim()) errors.sender_facebook = 'Facebook name is required for updates.';
    if (!form.sender_province) errors.sender_province = 'Province is required.';
    if (form.sender_province === 'Other Area' && !form.sender_other_province.trim()) {
      errors.sender_other_province = 'Please enter your province name.';
    }
    if (!form.sender_city.trim()) errors.sender_city = 'City / Municipality is required.';
    if (!form.sender_barangay.trim()) errors.sender_barangay = 'Barangay is required.';
    if (!form.sender_street.trim()) errors.sender_street = 'Street address is required.';

    if (!form.receiver_first_name.trim()) errors.receiver_first_name = 'First name is required.';
    if (!form.receiver_last_name.trim()) errors.receiver_last_name = 'Last name is required.';
    const receiverPhoneErr = validatePhone(form.receiver_phone);
    if (receiverPhoneErr) errors.receiver_phone = receiverPhoneErr;
    if (!form.receiver_facebook.trim()) errors.receiver_facebook = 'Facebook name is required for delivery coordination.';
    if (!form.receiver_province) errors.receiver_province = 'Province is required.';
    if (!form.receiver_city.trim()) errors.receiver_city = 'City / Municipality is required.';
    if (!form.receiver_barangay.trim()) errors.receiver_barangay = 'Barangay is required.';
    if (!form.receiver_street.trim()) errors.receiver_street = 'Street address is required.';

    if (!form.package_description.trim()) {
      errors.package_description = 'Please describe the contents of your cargo.';
    }

    const qty = parseInt(form.package_quantity || 1, 10);
    if (isNaN(qty) || qty < 1 || qty > 50) {
      errors.package_quantity = 'Quantity must be between 1 and 50.';
    }

    if (form.tripSelectionMode === 'scheduled' && !form.trip_id) {
      errors.trip_id = 'Please select a scheduled trip or choose "Book without selecting a trip".';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error('Please complete all required fields correctly.');
      const firstErrKey = Object.keys(errors)[0];
      const el = document.getElementById(`pub-book-${firstErrKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: null, // Public non-authenticated booking
        origin: selectedRouteObj.origin,
        destination: selectedRouteObj.destination,
        trip_id: form.tripSelectionMode === 'scheduled' && form.trip_id ? form.trip_id : null,
        sender_first_name: normalizeName(form.sender_first_name),
        sender_middle_name: normalizeName(form.sender_middle_name) || null,
        sender_last_name: normalizeName(form.sender_last_name),
        sender_name: `${normalizeName(form.sender_first_name)} ${normalizeName(form.sender_last_name)}`.trim(),
        sender_phone: form.sender_phone,
        sender_facebook: normalizeName(form.sender_facebook),
        sender_province: form.sender_province === 'Other Area' ? form.sender_other_province.trim() : form.sender_province,
        sender_city: form.sender_city.trim(),
        sender_barangay: form.sender_barangay.trim(),
        sender_street: form.sender_street.trim(),
        sender_lot_block: form.sender_lot_block.trim() || null,
        sender_landmark: form.sender_landmark.trim() || null,
        sender_address: [
          form.sender_lot_block.trim(),
          form.sender_street.trim(),
          form.sender_barangay.trim(),
          form.sender_city.trim(),
          form.sender_province === 'Other Area' ? form.sender_other_province.trim() : form.sender_province,
          form.sender_landmark.trim() ? `(Landmark: ${form.sender_landmark.trim()})` : '',
        ].filter(Boolean).join(', '),
        receiver_first_name: normalizeName(form.receiver_first_name),
        receiver_middle_name: normalizeName(form.receiver_middle_name) || null,
        receiver_last_name: normalizeName(form.receiver_last_name),
        receiver_name: `${normalizeName(form.receiver_first_name)} ${normalizeName(form.receiver_last_name)}`.trim(),
        receiver_phone: form.receiver_phone,
        receiver_facebook: normalizeName(form.receiver_facebook),
        receiver_province: form.receiver_province,
        receiver_city: form.receiver_city.trim(),
        receiver_barangay: form.receiver_barangay.trim(),
        receiver_street: form.receiver_street.trim(),
        receiver_lot_block: form.receiver_lot_block.trim() || null,
        receiver_landmark: form.receiver_landmark.trim() || null,
        receiver_address: [
          form.receiver_lot_block.trim(),
          form.receiver_street.trim(),
          form.receiver_barangay.trim(),
          form.receiver_city.trim(),
          form.receiver_province,
          form.receiver_landmark.trim() ? `(Landmark: ${form.receiver_landmark.trim()})` : '',
        ].filter(Boolean).join(', '),
        package_description: form.package_description.trim(),
        package_quantity: Math.max(1, Math.min(50, parseInt(form.package_quantity || 1, 10))),
        payer_type: form.payer_type,
        payment_preference: form.payment_preference,
        notes: form.notes.trim() || null,
      };

      if (form.sender_province === 'Other Area') {
        payload.service_area_status = 'for_review';
        payload.status = 'Pending Review';
      }

      const orderResult = await createOrder(payload);
      setBookingSuccess(orderResult);
      toast.success(`Booking created! Tracking Number: ${orderResult.tracking_number}`);

      if (onBookingComplete) {
        onBookingComplete(orderResult);
      }

      setTimeout(() => {
        if (successRef.current) {
          successRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      toast.error(err?.message || 'Failed to submit booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTracking = async () => {
    if (!bookingSuccess?.tracking_number) return;
    const ok = await copyTextToClipboard(bookingSuccess.tracking_number);
    if (ok) {
      setCopied(true);
      toast.success('Tracking number copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error('Could not auto-copy. Please highlight and copy the tracking number.');
    }
  };

  const startNewBooking = () => {
    setBookingSuccess(null);
    setForm(emptyForm('Manila to Bohol', ''));
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIRMATION VIEW (AFTER SUBMISSION)
  // ══════════════════════════════════════════════════════════════════════════
  if (bookingSuccess) {
    const isAssigned = bookingSuccess.status === 'Assigned';
    const isPendingReview = bookingSuccess.status === 'Pending Review';

    return (
      <div
        ref={successRef}
        className="card"
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg, 16px)',
          border: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          background: 'var(--bg-primary, #fff)',
        }}
        role="region"
        aria-label="Booking Confirmation"
      >
        {/* Banner Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary, #0f766e) 0%, #115e59 100%)',
            color: '#fff',
            padding: '32px 24px 28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={36} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
            Booking Confirmed!
          </h2>
          <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
            {isPendingReview
              ? 'Your booking is under review for special pickup coverage.'
              : isAssigned
                ? 'Your cargo slot has been assigned to the scheduled trip.'
                : 'Your booking has been received and queued for dispatch assignment.'}
          </p>
        </div>

        {/* Content Details */}
        <div style={{ padding: '28px 24px' }}>
          {/* Tracking Number Highlight Box */}
          <div
            style={{
              background: 'var(--bg-secondary, #f8fafc)',
              border: '2px dashed var(--primary, #0f766e)',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '20px',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Official Tracking Number
            </span>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--primary, #0f766e)',
                letterSpacing: '1px',
                margin: '8px 0 12px',
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {bookingSuccess.tracking_number}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopyTracking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {copied ? (
                <>
                  <Check size={18} /> Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy size={18} /> Copy Tracking Number
                </>
              )}
            </button>
            <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
              Save or screenshot this tracking number. You can use it anytime to track your cargo on our website.
            </p>
          </div>

          {/* Quick Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 24,
              fontSize: '0.9rem',
            }}
          >
            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'block' }}>Route</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                {bookingSuccess.origin} → {bookingSuccess.destination}
              </strong>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'block' }}>Status</span>
              <strong style={{ fontSize: '1rem', color: isAssigned ? 'var(--success)' : 'var(--warning)' }}>
                {bookingSuccess.status || 'Pending'}
              </strong>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'block' }}>Sender</span>
              <strong>{bookingSuccess.sender_name}</strong> ({bookingSuccess.sender_phone})
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'block' }}>Receiver</span>
              <strong>{bookingSuccess.receiver_name}</strong> ({bookingSuccess.receiver_phone})
            </div>
          </div>

          {/* Notice on Weighed-at-pickup */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--info-bg, #eff6ff)',
              border: '1px solid var(--info-border, #bfdbfe)',
              borderRadius: 8,
              color: 'var(--info-text, #1e40af)',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Info size={18} flexShrink={0} style={{ marginTop: 2 }} />
            <div>
              <strong>Weight &amp; Pricing Note:</strong> Your cargo will be weighed upon collection at pickup.
              The total shipping fee is calculated automatically based on the actual weighed kilograms (Rate: {formatMoney(pricePerKg)}/kg).
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link
              to={`/track?q=${encodeURIComponent(bookingSuccess.tracking_number)}`}
              className="btn btn-primary"
              style={{
                flex: 1,
                minWidth: 200,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
                fontWeight: 600,
              }}
            >
              <Package size={18} /> Track This Shipment Now
            </Link>

            <button
              type="button"
              className="btn btn-outline"
              onClick={startNewBooking}
              style={{
                flex: 1,
                minWidth: 200,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
              }}
            >
              Book Another Cargo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN BOOKING FORM VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <form
      id="direct-cargo-booking-form"
      onSubmit={handleSubmit}
      className="public-booking-form-clean"
    >
      {/* Form Intro Header */}
      <div style={{ marginBottom: 28, borderBottom: '1.5px solid var(--border, #e2e8f0)', paddingBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          <ShieldCheck size={18} /> No Login Required · Quick Public Booking
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800 }}>
          Book Cargo Delivery
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem' }}>
          Fill out the sender, receiver, and parcel details below. Your shipment will be assigned immediately and given a unique tracking number.
        </p>
      </div>

      {/* ── STEP 1: ROUTE & TRIP SELECTION ── */}
      <section className="pub-step-box">
        <h3 className="pub-step-title">
          <span className="pub-step-num">1</span>
          <Truck size={20} color="var(--primary)" /> Route &amp; Trip Selection
        </h3>

        {/* Route Pills */}
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">Delivery Route <span className="required">*</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {ROUTES.map((r) => {
              const active = selectedRouteObj.origin === r.origin && selectedRouteObj.destination === r.destination;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => handleRouteChange(r.label)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: active ? '2px solid var(--primary, #0f766e)' : '1px solid var(--border, #cbd5e1)',
                    background: active ? 'var(--primary-bg, #f0fdfa)' : 'var(--bg-primary, #fff)',
                    color: active ? 'var(--primary, #0f766e)' : 'var(--text-primary)',
                    fontWeight: 700,
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: '1rem',
                  }}
                >
                  <span>{r.origin}</span>
                  <ArrowRight size={16} />
                  <span>{r.destination}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Flexible Trip Choice: Select Scheduled Trip vs Book Without Trip */}
        <div
          style={{
            background: 'var(--bg-secondary, #f8fafc)',
            padding: 16,
            borderRadius: 'var(--radius-md, 10px)',
            border: '1px solid var(--border, #e2e8f0)',
            marginBottom: 16,
          }}
        >
          <label className="form-label" style={{ marginBottom: 10, fontWeight: 700 }}>
            Trip Scheduling Preference:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="tripSelectionMode"
                value="scheduled"
                checked={form.tripSelectionMode === 'scheduled'}
                onChange={() => updateField('tripSelectionMode', 'scheduled')}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Select an available scheduled trip</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Reserve capacity on an upcoming scheduled departure with known ETA.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="tripSelectionMode"
                value="flexible"
                checked={form.tripSelectionMode === 'flexible'}
                onChange={() => {
                  updateField('tripSelectionMode', 'flexible');
                  updateField('trip_id', '');
                }}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Book without selecting a trip (Flexible / Pending)</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Submit now and let our Dispatch Team assign the soonest trip based on your pickup location.
                </p>
              </div>
            </label>
          </div>

          {/* If Scheduled Trip is chosen, show dropdown of trips */}
          {form.tripSelectionMode === 'scheduled' && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)' }}>
              <label className="form-label" htmlFor="pub-book-trip_id">
                Available Departures ({selectedRouteObj.origin} → {selectedRouteObj.destination}) <span className="required">*</span>
              </label>

              {tripsLoading ? (
                <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Loader size={16} className="spinner" /> Loading upcoming trips...
                </div>
              ) : availableRouteTrips.length === 0 ? (
                <div style={{ padding: 12, background: 'var(--warning-bg, #fffbeb)', border: '1px solid var(--warning-border, #fde68a)', borderRadius: 8, fontSize: '0.85rem' }}>
                  No open scheduled trips currently for this route. You can choose <strong>"Book without selecting a trip"</strong> above to queue your booking for the next schedule!
                </div>
              ) : (
                <>
                  <CustomSelect
                    id="pub-book-trip_id"
                    value={form.trip_id}
                    onChange={(e) => updateField('trip_id', e.target.value)}
                    className={fieldErrors.trip_id ? 'field-invalid' : ''}
                  >
                    <option value="">-- Choose a Scheduled Trip --</option>
                    {availableRouteTrips.map((t) => {
                      const spaceKg = Math.max(0, (t.capacity || 0) - (t.current_weight || 0));
                      const dep = formatPhDate(t.departure_date);
                      const arr = t.arrival_date ? ` (ETA: ${formatPhDate(t.arrival_date)})` : '';
                      return (
                        <option key={t.id} value={t.id}>
                          {t.trip_number} · Departs {dep}{arr} · {spaceKg.toLocaleString()} kg left
                        </option>
                      );
                    })}
                  </CustomSelect>
                  {fieldErrors.trip_id && <p className="field-error-text" role="alert">{fieldErrors.trip_id}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── STEP 2: SENDER DETAILS ── */}
      <section className="pub-step-box">
        <h3 className="pub-step-title">
          <span className="pub-step-num">2</span>
          <User size={20} color="var(--primary)" /> Sender Details (Pickup Contact)
        </h3>

        {/* Sender Name Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-sender_first_name">
              First Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-sender_first_name"
              type="text"
              className={`form-input ${fieldErrors.sender_first_name ? 'field-invalid' : ''}`}
              value={form.sender_first_name}
              onChange={(e) => updateField('sender_first_name', e.target.value)}
              placeholder="First Name"
              required
            />
            {fieldErrors.sender_first_name && <p className="field-error-text">{fieldErrors.sender_first_name}</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-sender_middle_name">Middle Name (Optional)</label>
            <input
              id="pub-book-sender_middle_name"
              type="text"
              className="form-input"
              value={form.sender_middle_name}
              onChange={(e) => updateField('sender_middle_name', e.target.value)}
              placeholder="Middle Name"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-sender_last_name">
              Last Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-sender_last_name"
              type="text"
              className={`form-input ${fieldErrors.sender_last_name ? 'field-invalid' : ''}`}
              value={form.sender_last_name}
              onChange={(e) => updateField('sender_last_name', e.target.value)}
              placeholder="Last Name"
              required
            />
            {fieldErrors.sender_last_name && <p className="field-error-text">{fieldErrors.sender_last_name}</p>}
          </div>
        </div>

        {/* Sender Contact & Social */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-sender_phone">
              Mobile Number <span className="required">*</span>
            </label>
            <input
              id="pub-book-sender_phone"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              className={`form-input ${fieldErrors.sender_phone ? 'field-invalid' : ''}`}
              value={form.sender_phone}
              onChange={(e) => handlePhoneInput('sender_phone', e.target.value)}
              placeholder="09xxxxxxxxx"
              required
            />
            {fieldErrors.sender_phone && <p className="field-error-text">{fieldErrors.sender_phone}</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-sender_facebook">
              Facebook Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-sender_facebook"
              type="text"
              className={`form-input ${fieldErrors.sender_facebook ? 'field-invalid' : ''}`}
              value={form.sender_facebook}
              onChange={(e) => updateField('sender_facebook', e.target.value)}
              placeholder="Your name or profile on Facebook"
              required
            />
            {fieldErrors.sender_facebook && <p className="field-error-text">{fieldErrors.sender_facebook}</p>}
          </div>
        </div>

        {/* Sender Pickup Address */}
        <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '16px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            PICKUP LOCATION ADDRESS
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_province">
                Province <span className="required">*</span>
              </label>
              <CustomSelect
                id="pub-book-sender_province"
                value={form.sender_province}
                onChange={(e) => {
                  updateField('sender_province', e.target.value);
                  updateField('sender_city', '');
                  updateField('sender_barangay', '');
                }}
                className={fieldErrors.sender_province ? 'field-invalid' : ''}
              >
                {senderProvinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </CustomSelect>
            </div>

            {form.sender_province === 'Other Area' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pub-book-sender_other_province">
                  Specify Province <span className="required">*</span>
                </label>
                <input
                  id="pub-book-sender_other_province"
                  type="text"
                  className={`form-input ${fieldErrors.sender_other_province ? 'field-invalid' : ''}`}
                  value={form.sender_other_province}
                  onChange={(e) => updateField('sender_other_province', e.target.value)}
                  placeholder="e.g. Pampanga, Rizal"
                  required
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_city">
                City / Municipality <span className="required">*</span>
              </label>
              {form.sender_province === 'Other Area' ? (
                <input
                  id="pub-book-sender_city"
                  type="text"
                  className={`form-input ${fieldErrors.sender_city ? 'field-invalid' : ''}`}
                  value={form.sender_city}
                  onChange={(e) => updateField('sender_city', e.target.value)}
                  placeholder="City / Municipality"
                  required
                />
              ) : (
                <CustomSelect
                  id="pub-book-sender_city"
                  value={form.sender_city}
                  onChange={(e) => {
                    updateField('sender_city', e.target.value);
                    updateField('sender_barangay', '');
                  }}
                  className={fieldErrors.sender_city ? 'field-invalid' : ''}
                >
                  <option value="">-- Select City --</option>
                  {senderCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </CustomSelect>
              )}
              {fieldErrors.sender_city && <p className="field-error-text">{fieldErrors.sender_city}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_barangay">
                Barangay <span className="required">*</span>
              </label>
              <BarangaySelect
                id="pub-book-sender_barangay"
                province={form.sender_province === 'Other Area' ? '' : form.sender_province}
                city={form.sender_city}
                value={form.sender_barangay}
                onChange={(e) => updateField('sender_barangay', e.target.value)}
                className={fieldErrors.sender_barangay ? 'field-invalid' : ''}
              />
              {fieldErrors.sender_barangay && <p className="field-error-text">{fieldErrors.sender_barangay}</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_street">
                Street Address <span className="required">*</span>
              </label>
              <input
                id="pub-book-sender_street"
                type="text"
                className={`form-input ${fieldErrors.sender_street ? 'field-invalid' : ''}`}
                value={form.sender_street}
                onChange={(e) => updateField('sender_street', e.target.value)}
                placeholder="Street / Purok / Sitio"
                required
              />
              {fieldErrors.sender_street && <p className="field-error-text">{fieldErrors.sender_street}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_lot_block">House / Lot / Unit No.</label>
              <input
                id="pub-book-sender_lot_block"
                type="text"
                className="form-input"
                value={form.sender_lot_block}
                onChange={(e) => updateField('sender_lot_block', e.target.value)}
                placeholder="e.g. Unit 4B, Blk 2 Lot 15"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-sender_landmark">Nearby Landmark</label>
              <input
                id="pub-book-sender_landmark"
                type="text"
                className="form-input"
                value={form.sender_landmark}
                onChange={(e) => updateField('sender_landmark', e.target.value)}
                placeholder="e.g. Near Brgy Hall / Chapel"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── STEP 3: RECEIVER DETAILS ── */}
      <section className="pub-step-box">
        <h3 className="pub-step-title">
          <span className="pub-step-num">3</span>
          <MapPin size={20} color="var(--primary)" /> Receiver Details (Delivery Contact)
        </h3>

        {/* Receiver Name Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-receiver_first_name">
              First Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-receiver_first_name"
              type="text"
              className={`form-input ${fieldErrors.receiver_first_name ? 'field-invalid' : ''}`}
              value={form.receiver_first_name}
              onChange={(e) => updateField('receiver_first_name', e.target.value)}
              placeholder="First Name"
              required
            />
            {fieldErrors.receiver_first_name && <p className="field-error-text">{fieldErrors.receiver_first_name}</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-receiver_middle_name">Middle Name (Optional)</label>
            <input
              id="pub-book-receiver_middle_name"
              type="text"
              className="form-input"
              value={form.receiver_middle_name}
              onChange={(e) => updateField('receiver_middle_name', e.target.value)}
              placeholder="Middle Name"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-receiver_last_name">
              Last Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-receiver_last_name"
              type="text"
              className={`form-input ${fieldErrors.receiver_last_name ? 'field-invalid' : ''}`}
              value={form.receiver_last_name}
              onChange={(e) => updateField('receiver_last_name', e.target.value)}
              placeholder="Last Name"
              required
            />
            {fieldErrors.receiver_last_name && <p className="field-error-text">{fieldErrors.receiver_last_name}</p>}
          </div>
        </div>

        {/* Receiver Contact & Social */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-receiver_phone">
              Mobile Number <span className="required">*</span>
            </label>
            <input
              id="pub-book-receiver_phone"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              className={`form-input ${fieldErrors.receiver_phone ? 'field-invalid' : ''}`}
              value={form.receiver_phone}
              onChange={(e) => handlePhoneInput('receiver_phone', e.target.value)}
              placeholder="09xxxxxxxxx"
              required
            />
            {fieldErrors.receiver_phone && <p className="field-error-text">{fieldErrors.receiver_phone}</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-receiver_facebook">
              Facebook Name <span className="required">*</span>
            </label>
            <input
              id="pub-book-receiver_facebook"
              type="text"
              className={`form-input ${fieldErrors.receiver_facebook ? 'field-invalid' : ''}`}
              value={form.receiver_facebook}
              onChange={(e) => updateField('receiver_facebook', e.target.value)}
              placeholder="Receiver's name on Facebook"
              required
            />
            {fieldErrors.receiver_facebook && <p className="field-error-text">{fieldErrors.receiver_facebook}</p>}
          </div>
        </div>

        {/* Receiver Delivery Address */}
        <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '16px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            DESTINATION DELIVERY ADDRESS
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_province">
                Province <span className="required">*</span>
              </label>
              <CustomSelect
                id="pub-book-receiver_province"
                value={form.receiver_province}
                onChange={(e) => {
                  updateField('receiver_province', e.target.value);
                  updateField('receiver_city', '');
                  updateField('receiver_barangay', '');
                }}
                className={fieldErrors.receiver_province ? 'field-invalid' : ''}
              >
                {receiverProvinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </CustomSelect>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_city">
                City / Municipality <span className="required">*</span>
              </label>
              <CustomSelect
                id="pub-book-receiver_city"
                value={form.receiver_city}
                onChange={(e) => {
                  updateField('receiver_city', e.target.value);
                  updateField('receiver_barangay', '');
                }}
                className={fieldErrors.receiver_city ? 'field-invalid' : ''}
              >
                <option value="">-- Select City --</option>
                {receiverCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </CustomSelect>
              {fieldErrors.receiver_city && <p className="field-error-text">{fieldErrors.receiver_city}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_barangay">
                Barangay <span className="required">*</span>
              </label>
              <BarangaySelect
                id="pub-book-receiver_barangay"
                province={form.receiver_province}
                city={form.receiver_city}
                value={form.receiver_barangay}
                onChange={(e) => updateField('receiver_barangay', e.target.value)}
                className={fieldErrors.receiver_barangay ? 'field-invalid' : ''}
              />
              {fieldErrors.receiver_barangay && <p className="field-error-text">{fieldErrors.receiver_barangay}</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_street">
                Street Address <span className="required">*</span>
              </label>
              <input
                id="pub-book-receiver_street"
                type="text"
                className={`form-input ${fieldErrors.receiver_street ? 'field-invalid' : ''}`}
                value={form.receiver_street}
                onChange={(e) => updateField('receiver_street', e.target.value)}
                placeholder="Street / Purok / Sitio"
                required
              />
              {fieldErrors.receiver_street && <p className="field-error-text">{fieldErrors.receiver_street}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_lot_block">House / Lot / Unit No.</label>
              <input
                id="pub-book-receiver_lot_block"
                type="text"
                className="form-input"
                value={form.receiver_lot_block}
                onChange={(e) => updateField('receiver_lot_block', e.target.value)}
                placeholder="e.g. Blk 5 Lot 10"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pub-book-receiver_landmark">Nearby Landmark</label>
              <input
                id="pub-book-receiver_landmark"
                type="text"
                className="form-input"
                value={form.receiver_landmark}
                onChange={(e) => updateField('receiver_landmark', e.target.value)}
                placeholder="e.g. Near Public Market"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── STEP 4: PACKAGE & PAYMENT DETAILS ── */}
      <section className="pub-step-box">
        <h3 className="pub-step-title">
          <span className="pub-step-num">4</span>
          <Package size={20} color="var(--primary)" /> Package &amp; Payment Preferences
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-package_description">
              Package Description <span className="required">*</span>
            </label>
            <input
              id="pub-book-package_description"
              type="text"
              className={`form-input ${fieldErrors.package_description ? 'field-invalid' : ''}`}
              value={form.package_description}
              onChange={(e) => updateField('package_description', e.target.value)}
              placeholder="e.g. Balikbayan box, personal clothes, documents"
              required
            />
            {fieldErrors.package_description && <p className="field-error-text">{fieldErrors.package_description}</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-package_quantity">
              Estimated Number of Boxes / Items <span className="required">*</span>
            </label>
            <input
              id="pub-book-package_quantity"
              type="number"
              min={1}
              max={50}
              className={`form-input ${fieldErrors.package_quantity ? 'field-invalid' : ''}`}
              value={form.package_quantity}
              onChange={(e) => updateField('package_quantity', e.target.value)}
              required
            />
            {fieldErrors.package_quantity && <p className="field-error-text">{fieldErrors.package_quantity}</p>}
          </div>
        </div>

        {/* Who Pays & Payment Preference */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Who Pays Shipping Fee?</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payer_type"
                  value="sender"
                  checked={form.payer_type === 'sender'}
                  onChange={() => updateField('payer_type', 'sender')}
                />
                <span>Sender (at pickup)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payer_type"
                  value="receiver"
                  checked={form.payer_type === 'receiver'}
                  onChange={() => updateField('payer_type', 'receiver')}
                />
                <span>Receiver (upon delivery)</span>
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pub-book-payment_preference">
              Payment Preference
            </label>
            <CustomSelect
              id="pub-book-payment_preference"
              value={form.payment_preference}
              onChange={(e) => updateField('payment_preference', e.target.value)}
            >
              <option value="unspecified">Pay Later (Cash or GCash upon collection)</option>
              <option value="gcash">GCash (Online / QR)</option>
              <option value="cash">Cash on Pickup / Delivery</option>
            </CustomSelect>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="pub-book-notes">
            Special Notes / Delivery Instructions (Optional)
          </label>
          <input
            id="pub-book-notes"
            type="text"
            className="form-input"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="e.g. Fragile items inside, please call 1 hour before pickup..."
          />
        </div>
      </section>

      {/* Submit Button */}
      <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: 24, textAlign: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{
            padding: '14px 32px',
            fontSize: '1.05rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minWidth: 260,
          }}
        >
          {submitting ? (
            <>
              <Loader size={20} className="spinner" /> Saving Your Booking...
            </>
          ) : (
            <>
              Confirm &amp; Generate Tracking Number <ChevronRight size={20} />
            </>
          )}
        </button>
        <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
          By booking, you agree to CargoExpress PH shipping terms and cargo inspection guidelines.
        </p>
      </div>
    </form>
  );
};

export default PublicBookingForm;
