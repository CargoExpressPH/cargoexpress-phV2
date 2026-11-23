import { useState } from 'react';
import { Send, CheckCircle2, MessageSquare, Phone, Mail, FileText, AlertCircle, Loader } from 'lucide-react';
import { createContactInquiry } from '../../lib/database';
import { useToast } from '../../hooks/useToast';

const PublicInquiryForm = () => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    const trimmedMessage = message.trim();
    const trimmedTracking = trackingNumber.trim().toUpperCase();

    if (trimmedName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!trimmedContact) {
      setError('Please provide your mobile number or email address.');
      return;
    }

    if (trimmedMessage.length < 10) {
      setError('Please write a message with at least 10 characters.');
      return;
    }

    // Determine phone vs email
    const isEmail = trimmedContact.includes('@');
    const contactPhone = !isEmail ? trimmedContact : null;
    const contactEmail = isEmail ? trimmedContact : null;

    // Attach tracking number to message if provided
    let finalMessage = trimmedMessage;
    if (trimmedTracking) {
      finalMessage = `[Regarding Tracking No: ${trimmedTracking}]\n\n${trimmedMessage}`;
    }

    setLoading(true);
    try {
      await createContactInquiry({
        name: trimmedName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        message: finalMessage,
        wants_announcements: false,
      });

      setSubmitted(true);
      toast.success('Your message has been sent to our dispatch team!');
    } catch (err) {
      setError(err?.message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setContact('');
    setTrackingNumber('');
    setMessage('');
    setSubmitted(false);
    setError('');
  };

  if (submitted) {
    return (
      <div
        className="card"
        style={{
          padding: '32px 24px',
          textAlign: 'center',
          background: 'var(--bg-primary, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border, #e2e8f0)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--success-bg, #ecfdf5)',
            color: 'var(--success, #10b981)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={32} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>Message Received!</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Salamat! Your inquiry has been sent directly to our dispatch desk. We will contact you at{' '}
          <strong>{contact}</strong> as soon as possible.
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{
        padding: '28px 24px',
        background: 'var(--bg-primary, #fff)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={20} color="var(--primary)" /> Send Direct Message / Inquiry
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)' }}>
          Have a question about rates, pickup areas, or scheduled departures? Send us a message and our team will get back to you promptly.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            background: 'var(--error-bg, #fef2f2)',
            border: '1px solid var(--error-border, #fecaca)',
            borderRadius: 'var(--radius-md, 8px)',
            color: 'var(--error, #dc2626)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          role="alert"
        >
          <AlertCircle size={16} flexShrink={0} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="inquiry-name">
            Your Name <span className="required" style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            id="inquiry-name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maria Santos"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="inquiry-contact">
            Phone or Email <span className="required" style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            id="inquiry-contact"
            type="text"
            className="form-input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="09171234567 or email@domain.com"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label" htmlFor="inquiry-tracking">
          Tracking Number <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>(Optional — if inquiring about an existing order)</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="inquiry-tracking"
            type="text"
            className="form-input"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
            placeholder="CE-YYYYMMDD-XXXX"
            autoCapitalize="characters"
            disabled={loading}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="form-label" htmlFor="inquiry-message">
          Your Message / Question <span className="required" style={{ color: 'var(--error)' }}>*</span>
        </label>
        <textarea
          id="inquiry-message"
          className="form-input"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what you'd like to ask or request (e.g. pickup date, special cargo handling)..."
          required
          disabled={loading}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 20px',
          fontWeight: 600,
        }}
      >
        {loading ? (
          <>
            <Loader size={18} className="spinner" /> Sending Message...
          </>
        ) : (
          <>
            <Send size={18} /> Send Message to Dispatch
          </>
        )}
      </button>
    </form>
  );
};

export default PublicInquiryForm;
