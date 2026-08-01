'use client';

import Link from 'next/link';

export default function Home() {
  const destinations = [
    {
      title: "Pokhara Valley Tour",
      duration: "4 Days / 3 Nights",
      price: "Rs. 29,900",
      imageClass: "fa-mountain-sun",
      desc: "Experience pristine lake views, sunrise at Sarangkot, and mountain paragliding."
    },
    {
      title: "Annapurna Base Camp",
      duration: "10 Days / 9 Nights",
      price: "Rs. 79,900",
      imageClass: "fa-person-hiking",
      desc: "Trudge through rhododendron forests up to the spectacular sanctuary of mountain peaks."
    },
    {
      title: "Kathmandu Heritage Trail",
      duration: "3 Days / 2 Nights",
      price: "Rs. 19,900",
      imageClass: "fa-gopuram",
      desc: "Explore ancient temples, royal squares, and bustling traditional bazaars."
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header / Nav */}
      <nav style={{
        background: 'rgba(11, 15, 25, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '1rem 2rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Sandesh Travels" style={{ height: '42px', objectFit: 'contain', background: '#fff', borderRadius: '6px', padding: '2px 6px' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Sandesh Travels</span>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/admin" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }} id="admin-portal-link">
              <i className="fa-solid fa-user-gear" style={{ marginRight: '0.5rem' }}></i> Admin Portal
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        background: 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 60%), var(--bg-base)',
        padding: '5rem 2rem 4rem',
        textAlign: 'center',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span className="badge badge-converted" style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
            <i className="fa-solid fa-star" style={{ marginRight: '0.5rem' }}></i> Custom Crafted Journeys
          </span>
          <h1 style={{ fontSize: '3rem', lineHeight: '1.15', marginBottom: '1.5rem', background: 'linear-gradient(to right, #FFF, #9CA3AF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Tailor-Made Adventures <br />Designed Just For You
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
            Plan your next get-away with Sandesh Travels. Tell us your travel dream, and we will build a custom day-by-day itinerary and track your journey right up to your safe return.
          </p>
          <a href="#inquiry-section" className="btn btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
            Contact Inquiry Desk <i className="fa-solid fa-arrow-down" style={{ marginLeft: '0.5rem' }}></i>
          </a>
        </div>
      </section>

      {/* Main Content Areas */}
      <main style={{ flexGrow: 1, maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem', width: '100%' }}>
        {/* Featured Tours Grid */}
        <section style={{ marginBottom: '5rem' }}>
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem' }}>Popular Tailored Routes</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Get inspiration for your next personalized escape.</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem'
          }}>
            {destinations.map((dest, idx) => (
              <article key={idx} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  height: '140px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--border-radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)'
                }}>
                  <i className={`fa-solid ${dest.imageClass}`}></i>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-new">{dest.duration}</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '1.1rem' }}>{dest.price}</span>
                </div>
                <h3 style={{ fontSize: '1.25rem' }}>{dest.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', flexGrow: 1 }}>{dest.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Inquiry Information and Contact Section */}
        <div className="grid-2" id="inquiry-section">
          {/* Offline Booking Contact Info */}
          <section className="glass-card" style={{ boxShadow: 'var(--shadow-glow)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <span className="badge badge-new" style={{ marginBottom: '0.5rem' }}>Bookings & Support</span>
              <h2 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>Offline Booking Desk</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                To customize a premium travel plan or book an inquiry, please contact our travel desk directly. We are available 24/7 via call or messaging.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', color: '#25D366' }}>
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>WhatsApp Desk</div>
                  <a href="https://wa.me/919647878373" target="_blank" rel="noopener noreferrer" style={{ color: '#FFF', fontWeight: '600', textDecoration: 'none' }}>+91 9647878373</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                  <i className="fa-solid fa-phone"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Call Direct Support</div>
                  <a href="tel:+919647878373" style={{ color: '#FFF', fontWeight: '600', textDecoration: 'none' }}>+91 9647878373</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', color: 'var(--accent-teal)' }}>
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Inquiry Desk</div>
                  <a href="mailto:santeshtravelsgtk@gmail.com" style={{ color: '#FFF', fontWeight: '600', textDecoration: 'none' }}>santeshtravelsgtk@gmail.com</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                  <i className="fa-solid fa-location-dot"></i>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Office Location</div>
                  Chota Singtam, Near Kishan School, Aho Busty, Pakyong - 737135
                </div>
              </div>
            </div>

            <a 
              href="https://wa.me/919647878373?text=Hi%20Sandesh%20Travels,%20I%20would%20like%20to%20plan%20a%20trip." 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.9rem', textAlign: 'center', display: 'block', background: 'linear-gradient(135deg, #25D366, #128C7E)', border: 'none', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)' }}
            >
              <i className="fa-brands fa-whatsapp" style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}></i> Chat WhatsApp Specialist
            </a>
          </section>

          {/* Workflow details */}
          <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>How it works</h2>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ color: 'var(--primary)', fontSize: '1.5rem', marginTop: '0.2rem' }}>
                  <i className="fa-solid fa-1"></i>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Connect Offline</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Contact our travel owner/specialist via WhatsApp, Phone call, or step into our local office.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ color: 'var(--accent-teal)', fontSize: '1.5rem', marginTop: '0.2rem' }}>
                  <i className="fa-solid fa-2"></i>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Construct Custom Itinerary</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    We immediately build your customized daily itinerary (including premium hotel stays and vehicle/driver allocation) in our dashboard.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ color: 'var(--secondary)', fontSize: '1.5rem', marginTop: '0.2rem' }}>
                  <i className="fa-solid fa-3"></i>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Get WhatsApp Link & Track</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Receive a link on WhatsApp to view your itinerary. Track active stays and driver schedules live throughout your journey.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        padding: '3rem 2rem',
        marginTop: '5rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <p>© 2026 Sandesh Travels. All rights reserved.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            Built for premium hotels and travel operators. Developed using Next.js, PostgreSQL, and Vanilla CSS.
          </p>
        </div>
      </footer>
    </div>
  );
}
