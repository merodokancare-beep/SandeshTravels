'use client';

import { useState } from 'react';

export default function AcceptQuotationButton({ itineraryId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/leads/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itineraryId })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('converted');
        setSuccess('Thank you! You have accepted the quotation. VaniTravels admin has been notified, and your driver and vehicle are now locked in.');
      } else {
        setError(data.error || 'Failed to accept quotation.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'converted') {
    return (
      <div className="animate-fade-in" style={{
        background: 'rgba(16,185,129,0.1)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 'var(--border-radius-md)',
        padding: '1.5rem',
        color: '#34D399',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <i className="fa-solid fa-circle-check fa-2x" style={{ marginBottom: '0.5rem', display: 'block' }}></i>
        <strong style={{ fontSize: '1.1rem', color: '#FFF' }}>Booking Confirmed & Accepted!</strong>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          {success || 'You have accepted this travel plan. VaniTravels operations center is coordinating your accommodation stays and transport logistics.'}
        </p>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="animate-fade-in" style={{
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 'var(--border-radius-md)',
        padding: '1.5rem',
        color: '#A5B4FC',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <i className="fa-solid fa-circle-check fa-2x" style={{ marginBottom: '0.5rem', display: 'block' }}></i>
        <strong style={{ fontSize: '1.1rem', color: '#FFF' }}>Journey Successfully Completed!</strong>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          This travel program is concluded. Thank you for choosing VaniTravels for your journey!
        </p>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="animate-fade-in" style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 'var(--border-radius-md)',
        padding: '1.5rem',
        color: '#FCA5A5',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <i className="fa-solid fa-circle-xmark fa-2x" style={{ marginBottom: '0.5rem', display: 'block' }}></i>
        <strong style={{ fontSize: '1.1rem', color: '#FFF' }}>Itinerary Cancelled</strong>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          This travel quotation has been cancelled. Please contact VaniTravels to generate a new package.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card animate-fade-in" style={{
      marginTop: '2rem',
      background: 'linear-gradient(135deg, rgba(31, 42, 63, 0.4) 0%, rgba(21, 28, 44, 0.4) 100%)',
      border: '1px solid var(--border)',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#FFF' }}>Ready to start your journey?</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Review your day-by-day plan above. Click below to accept this travel quotation and lock in your transport vehicle and hotel reservations instantly.
      </p>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem', padding: '0.50rem' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.5rem' }}></i>
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={loading}
        className="btn btn-primary"
        style={{
          padding: '1rem 2.5rem',
          fontSize: '1.05rem',
          background: 'linear-gradient(135deg, var(--primary), var(--accent-teal))',
          boxShadow: 'var(--shadow-glow)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: '700',
          borderRadius: 'var(--border-radius-md)'
        }}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i> Confirming...
          </>
        ) : (
          <>
            Accept Quotation & Confirm Booking <i className="fa-solid fa-check" style={{ marginLeft: '0.5rem' }}></i>
          </>
        )}
      </button>
    </div>
  );
}
