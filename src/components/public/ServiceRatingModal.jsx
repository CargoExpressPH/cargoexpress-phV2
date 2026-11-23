import { useState, useEffect } from 'react';
import { Star, X, CheckCircle2, AlertCircle, Loader, MessageSquare } from 'lucide-react';
import FocusTrap from '../ui/FocusTrap';
import { submitFeedback } from '../../lib/database';
import { useToast } from '../../hooks/useToast';

const STAR_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const ServiceRatingModal = ({ isOpen, onClose, order, onFeedbackSubmitted }) => {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setRating(5);
      setHoverRating(0);
      setMessage('');
      setSubmitted(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setError('Please share a few words about your experience.');
      return;
    }

    setLoading(true);
    try {
      const feedback = await submitFeedback({
        orderId: order.id,
        customerId: null,
        rating,
        message: trimmedMsg,
      });

      setSubmitted(true);
      toast.success('Thank you for rating our delivery service!');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(feedback || { rating, message: trimmedMsg });
      }
    } catch (err) {
      setError(err?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
      <FocusTrap>
        <div
          className="modal-content card"
          style={{ maxWidth: 480, width: '92%', padding: 0, overflow: 'hidden', margin: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary, #f8fafc)',
            }}
          >
            <div>
              <h2 id="rating-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Rate This Service
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                Shipment {order.tracking_number}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              aria-label="Close modal"
              style={{ padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>

          {submitted ? (
            <div style={{ padding: '36px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'var(--success-bg, #ecfdf5)',
                  color: 'var(--success, #10b981)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>Salamat sa Feedback!</h3>
              <p style={{ margin: '0 0 24px', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Your review has been successfully recorded and helps us continually improve our Bohol-Manila cargo services.
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose} style={{ minWidth: 140 }}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    marginBottom: 18,
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

              {/* Star Rating Selector */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                  How would you rate your delivery experience?
                </p>
                <div style={{ display: 'inline-flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        transition: 'transform 0.15s ease',
                        transform: activeRating >= star ? 'scale(1.15)' : 'scale(1)',
                      }}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        size={32}
                        fill={star <= activeRating ? '#f59e0b' : 'none'}
                        color={star <= activeRating ? '#f59e0b' : 'var(--border, #cbd5e1)'}
                      />
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary, #0f766e)' }}>
                  {STAR_LABELS[activeRating]} ({activeRating} of 5 Stars)
                </div>
              </div>

              {/* Review Text */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="rating-review-message">
                  Your Review / Comments <span className="required" style={{ color: 'var(--error)' }}>*</span>
                </label>
                <textarea
                  id="rating-review-message"
                  className="form-input"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share details about the cargo condition, delivery timeliness, and staff friendliness..."
                  required
                  disabled={loading}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 140, justifyContent: 'center' }}
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="spinner" /> Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </FocusTrap>
    </div>
  );
};

export default ServiceRatingModal;
