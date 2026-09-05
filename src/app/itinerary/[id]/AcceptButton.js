'use client';

import { useState } from 'react';

export default function AcceptQuotationButton({
  itineraryId,
  initialStatus,
  initialPaymentStatus = 'unpaid',
  initialTransactionRef = '',
  initialAdvancePaid = 0,
  packagePrice = 0,
  clientName = 'Traveler',
  companySettings = null
}) {
  const [status, setStatus] = useState(initialStatus || 'new');
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus || 'unpaid');
  const [transactionRef, setTransactionRef] = useState(initialTransactionRef || '');
  const [advancePaid, setAdvancePaid] = useState(initialAdvancePaid || 0);

  const priceNum = parseFloat(packagePrice) || 0;
  const advancePct = companySettings?.advance_percentage || 10;
  const minAdvance = Math.round(priceNum * (advancePct / 100));
  const remainingBalance = Math.max(0, priceNum - (advancePaid > 0 ? advancePaid : minAdvance));

  const [enteredAmount, setEnteredAmount] = useState(minAdvance > 0 ? String(minAdvance) : '');
  const [utrInput, setUtrInput] = useState('');
  const [paymentMode, setPaymentMode] = useState('upi'); // 'upi' or 'bank'
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Live UPI & Bank Configurations from Company Settings
  const upiId = companySettings?.upi_id || '9647878373@upi';
  const payeeName = companySettings?.upi_payee_name || companySettings?.company_name || 'Sandesh Travels';
  const paymentNote = `Advance Deposit for Itinerary #${itineraryId}`;
  const amountToPay = enteredAmount ? parseFloat(enteredAmount) : minAdvance;

  // Standard UPI URI format
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountToPay}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upiUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleSubmitAdvance = async (e) => {
    if (e) e.preventDefault();
    if (!utrInput.trim()) {
      setError('Please enter your 12-digit UPI Transaction Ref / UTR Number to confirm payment.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/leads/submit-advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itineraryId,
          transactionRef: utrInput.trim(),
          amount: amountToPay,
          paymentMethod: paymentMode === 'upi' ? 'upi_qr' : 'bank_transfer'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setPaymentStatus('pending_verification');
        setTransactionRef(utrInput.trim());
        setAdvancePaid(amountToPay);
        setSuccess('Advance payment submitted successfully! Our team is verifying your deposit to confirm your booking.');
      } else {
        setError(data.error || 'Failed to submit advance payment details.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  // State 1: Converted / Advance Verified & Booking Active
  if (status === 'converted' || status === 'assigned' || paymentStatus === 'advance_paid') {
    return (
      <div className="animate-fade-in glass-card" style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,78,59,0.2) 100%)',
        border: '1px solid rgba(52,211,153,0.3)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '2rem',
        textAlign: 'center',
        marginTop: '2.5rem',
        boxShadow: '0 10px 25px -5px rgba(16,185,129,0.1)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(52,211,153,0.2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#34D399',
          fontSize: '1.75rem',
          marginBottom: '1rem'
        }}>
          <i className="fa-solid fa-shield-heart"></i>
        </div>
        <h3 style={{ fontSize: '1.4rem', color: '#FFF', marginBottom: '0.5rem', fontWeight: 800 }}>
          Booking Confirmed & Advance Verified!
        </h3>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
          Thank you <strong style={{ color: '#FFF' }}>{clientName}</strong>! Your {advancePct}% advance deposit has been confirmed. Your transport driver, vehicle allocation, and hotel check-in stays are officially secured.
        </p>

        <div style={{
          display: 'inline-flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          background: 'rgba(11,15,25,0.6)',
          padding: '1rem 1.75rem',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ADVANCE DEPOSIT</div>
            <strong style={{ color: '#34D399', fontSize: '1.1rem' }}>₹{advancePaid > 0 ? advancePaid.toLocaleString('en-IN') : minAdvance.toLocaleString('en-IN')}</strong>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>REMAINING BALANCE DUE</div>
            <strong style={{ color: '#FFF', fontSize: '1.1rem' }}>₹{remainingBalance.toLocaleString('en-IN')}</strong>
          </div>
          {transactionRef && (
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UTR / REF NO.</div>
              <code style={{ color: '#A5B4FC', fontSize: '0.9rem' }}>{transactionRef}</code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State 2: Payment Submitted - Verification in Progress
  if (paymentStatus === 'pending_verification') {
    return (
      <div className="animate-fade-in glass-card" style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(120,53,15,0.2) 100%)',
        border: '1px solid rgba(251,191,36,0.35)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '2rem',
        textAlign: 'center',
        marginTop: '2.5rem'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(251,191,36,0.2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FBBF24',
          fontSize: '1.75rem',
          marginBottom: '1rem'
        }}>
          <i className="fa-solid fa-clock-rotate-left"></i>
        </div>
        <h3 style={{ fontSize: '1.35rem', color: '#FFF', marginBottom: '0.5rem', fontWeight: 800 }}>
          Advance Payment Submitted — Verification in Progress
        </h3>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '620px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
          We have received your payment reference. Our operations center is verifying your deposit of <strong style={{ color: '#FBBF24' }}>₹{amountToPay.toLocaleString('en-IN')}</strong> (UTR: <code style={{ color: '#FFF', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{transactionRef}</code>). Once approved, your driver & vehicle will be officially locked.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={`https://wa.me/${(companySettings?.phone || '919647878373').replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(companySettings?.company_name || 'Sandesh Travels')},%20I%20have%20transferred%20the%20${advancePct}%%20advance%20of%20Rs.%20${amountToPay}%20for%20Itinerary%20ID%20${itineraryId}.%20UTR:%20${transactionRef}.%20Please%20confirm%20my%20booking.`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', background: '#25D366', color: '#FFF' }}
          >
            <i className="fa-brands fa-whatsapp"></i> Notify Operations on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // State 3: Completed Journey
  if (status === 'completed') {
    return (
      <div className="animate-fade-in glass-card" style={{
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
          This travel program has concluded. Thank you for choosing {companySettings?.company_name || 'Sandesh Travels'}!
        </p>
      </div>
    );
  }

  // State 4: Cancelled
  if (status === 'cancelled') {
    return (
      <div className="animate-fade-in glass-card" style={{
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
          This travel quotation is no longer active. Please contact {companySettings?.company_name || 'Sandesh Travels'} for a refreshed itinerary.
        </p>
      </div>
    );
  }

  // State 5: Unpaid - Show Advance Deposit Payment Box with Dynamic UPI QR
  return (
    <section className="glass-card animate-fade-in" style={{
      marginTop: '3rem',
      background: 'linear-gradient(135deg, rgba(21, 28, 44, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '2.5rem 2rem',
      boxShadow: 'var(--shadow-glow)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span className="badge badge-new" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Official Booking Policy
        </span>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.75rem', marginBottom: '0.5rem', color: '#FFF' }}>
          Confirm Booking with {advancePct}% Advance Deposit
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto' }}>
          As per {companySettings?.company_name || 'Sandesh Travels'} company policy, lock in your dedicated vehicle driver and hotel reservations by paying a minimum {advancePct}% advance deposit. Pay the remaining balance upon arrival.
        </p>
      </div>

      {/* Pricing Breakdown Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius-md)',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Tour Package</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.25rem' }}>
            ₹{priceNum > 0 ? priceNum.toLocaleString('en-IN') : 'Quote Pending'}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(56,189,248,0.15))',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 'var(--border-radius-md)',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#A5B4FC', fontWeight: 600, textTransform: 'uppercase' }}>
            {advancePct}% Advance to Confirm
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.25rem' }}>
            ₹{minAdvance > 0 ? minAdvance.toLocaleString('en-IN') : '0'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38BDF8', marginTop: '0.2rem' }}>Secures vehicle & hotels</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius-md)',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance on Arrival</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            ₹{remainingBalance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Payment Modes Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.75rem' }}>
        <button
          type="button"
          onClick={() => setPaymentMode('upi')}
          className={`btn ${paymentMode === 'upi' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', borderRadius: '30px' }}
        >
          <i className="fa-solid fa-qrcode" style={{ marginRight: '0.4rem' }}></i> UPI QR / Apps (GPay, PhonePe, Paytm)
        </button>
        <button
          type="button"
          onClick={() => setPaymentMode('bank')}
          className={`btn ${paymentMode === 'bank' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', borderRadius: '30px' }}
        >
          <i className="fa-solid fa-building-columns" style={{ marginRight: '0.4rem' }}></i> Bank NEFT / IMPS
        </button>
      </div>

      {/* Payment Details Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: paymentMode === 'upi' ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
        gap: '2rem',
        background: 'rgba(11, 15, 25, 0.7)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius-md)',
        padding: '1.75rem',
        alignItems: 'center'
      }}>
        {paymentMode === 'upi' ? (
          <>
            {/* QR Code Section */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                background: '#FFFFFF',
                padding: '12px',
                borderRadius: '16px',
                display: 'inline-block',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                marginBottom: '1rem'
              }}>
                <img
                  src={qrCodeUrl}
                  alt={`Scan to pay ${advancePct}% advance deposit`}
                  style={{ width: '190px', height: '190px', display: 'block' }}
                />
              </div>
              <div style={{ fontSize: '0.85rem', color: '#FFF', fontWeight: 600 }}>
                Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>UPI ID:</span>
                <strong style={{ fontSize: '0.85rem', color: '#38BDF8' }}>{upiId}</strong>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem' }}
                  title="Copy UPI ID"
                >
                  <i className={`fa-solid ${copiedUpi ? 'fa-check' : 'fa-copy'}`}></i>
                </button>
              </div>
              {/* Mobile Direct Pay Button */}
              <div style={{ marginTop: '1rem', width: '100%', maxWidth: '240px' }}>
                <a
                  href={upiUrl}
                  className="btn btn-outline"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', textDecoration: 'none', display: 'block', textAlign: 'center' }}
                >
                  <i className="fa-solid fa-mobile-screen" style={{ marginRight: '0.4rem' }}></i> Open in UPI App
                </a>
              </div>
            </div>

            {/* Submission Form */}
            <div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#FFF' }}>
                Step 2: Enter UPI Transaction ID / UTR
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                Once you complete the {advancePct}% transfer (₹{amountToPay.toLocaleString('en-IN')}), enter the 12-digit UPI Reference / UTR Number found on your payment receipt below:
              </p>

              <form onSubmit={handleSubmitAdvance}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                    12-Digit UPI Transaction UTR Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 423589123456 or T240905..."
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 'var(--border-radius-sm)',
                      color: '#FFF',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                    Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 'var(--border-radius-sm)',
                      color: '#FFF',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ marginBottom: '1rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--primary), var(--accent-teal))',
                    border: 'none',
                    borderRadius: 'var(--border-radius-sm)',
                    boxShadow: 'var(--shadow-glow)'
                  }}
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i> Submitting...
                    </>
                  ) : (
                    <>
                      I have Paid ₹{amountToPay.toLocaleString('en-IN')} — Submit for Confirmation <i className="fa-solid fa-arrow-right" style={{ marginLeft: '0.4rem' }}></i>
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Bank Transfer Details View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '1.05rem', color: '#FFF', marginBottom: '1rem' }}>
                <i className="fa-solid fa-building-columns" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                {companySettings?.company_name || 'Sandesh Travels'} Bank Account
              </h4>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                <div><strong>Account Name:</strong> {companySettings?.bank_account_name || companySettings?.company_name || 'M/s Sandesh Travels'}</div>
                <div><strong>Account Number:</strong> {companySettings?.bank_account_number || '412309876543'}</div>
                <div><strong>IFSC Code:</strong> {companySettings?.bank_ifsc || 'SBIN0001234'}</div>
                <div><strong>Bank Name:</strong> {companySettings?.bank_name || 'State Bank of India'}</div>
                <div><strong>Branch:</strong> {companySettings?.bank_branch || 'Pakyong / Gangtok Branch'}</div>
                <div><strong>Account Type:</strong> {companySettings?.bank_account_type || 'Current Account'}</div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: '#FFF' }}>
                Submit Bank Transfer Reference
              </h4>
              <form onSubmit={handleSubmitAdvance}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                    NEFT / IMPS Reference Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBIN423589123456"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 'var(--border-radius-sm)',
                      color: '#FFF',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
                    Amount Transferred (₹)
                  </label>
                  <input
                    type="number"
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 'var(--border-radius-sm)',
                      color: '#FFF',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ marginBottom: '1rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--primary), var(--accent-teal))',
                    border: 'none',
                    borderRadius: 'var(--border-radius-sm)'
                  }}
                >
                  {loading ? 'Submitting...' : `Submit Bank Transfer Details (₹${amountToPay.toLocaleString('en-IN')})`}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
