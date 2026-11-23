import { useEffect } from 'react';
import { ThumbsUp, ExternalLink, X, Heart } from 'lucide-react';
import FocusTrap from '../ui/FocusTrap';

const FB_PAGE_URL = 'https://www.facebook.com/mscargodeliveryservice';

const FacebookFollowModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
      <FocusTrap>
        <div
          className="modal-content card"
          style={{ maxWidth: 480, width: '92%', padding: 0, overflow: 'hidden', margin: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1877f2 0%, #0d5cb6 100%)',
              color: '#fff',
              padding: '24px 24px 20px',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <ThumbsUp size={28} color="#fff" />
            </div>
            <h2 id="fb-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Messenger Chat Opened!
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
              We've launched Messenger in a new tab so you can chat with us directly.
            </p>
          </div>

          {/* Body Content */}
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div
              style={{
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '16px',
                marginBottom: 20,
              }}
            >
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.95rem' }}>
                Follow Marlon Sarong Cargo Delivery Service
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', lineHeight: 1.5 }}>
                Get real-time updates on upcoming trip departures, schedule announcements, and exclusive promo discounts by following our official Facebook page.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href={FB_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  backgroundColor: '#1877f2',
                  borderColor: '#1877f2',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-md, 8px)',
                }}
                onClick={onClose}
              >
                <ThumbsUp size={18} /> Like &amp; Follow Official Facebook Page
                <ExternalLink size={16} />
              </a>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                style={{ padding: '10px 16px', fontSize: '0.875rem' }}
              >
                Close &amp; Continue
              </button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

export default FacebookFollowModal;
