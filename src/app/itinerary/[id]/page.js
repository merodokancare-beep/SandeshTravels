import Link from 'next/link';
import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import AcceptQuotationButton from './AcceptButton';

function getFormattedDateForDay(startDate, dayNum) {
  if (!startDate) return '';
  let date;
  if (startDate instanceof Date) {
    date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  } else {
    const parts = String(startDate).substring(0, 10).split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    date = new Date(year, month, day);
  }
  
  date.setDate(date.getDate() + (dayNum - 1));
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}


export const metadata = {
  title: "Your VaniTravels Custom Itinerary",
  description: "View your day-by-day travel plan, accommodation stays, and transport details online.",
};

export default async function GuestItinerary({ params }) {
  const { id } = await params;
  const itineraryId = parseInt(id, 10);

  if (isNaN(itineraryId)) {
    return notFound();
  }

  // 1. Fetch Itinerary
  const itinRes = await query('SELECT * FROM itineraries WHERE id = $1', [itineraryId]);
  if (itinRes.rows.length === 0) {
    return notFound();
  }
  const itinerary = itinRes.rows[0];

  // 2. Fetch Lead Info
  const leadRes = await query('SELECT * FROM leads WHERE id = $1', [itinerary.lead_id]);
  const lead = leadRes.rows[0];

  // 3. Fetch Itinerary Days joined with Hotels and Drivers details
  const daysRes = await query(
    `SELECT id_day.*, 
            h.name as hotel_name, h.location as hotel_location, h.contact as hotel_contact,
            d.driver_name, d.driver_phone, d.vehicle_number, d.vehicle_model
     FROM itinerary_days id_day
     LEFT JOIN hotels_registry h ON id_day.hotel_id = h.id
     LEFT JOIN drivers_registry d ON id_day.driver_id = d.id
     WHERE id_day.itinerary_id = $1
     ORDER BY id_day.day_number ASC`,
    [itineraryId]
  );
  const days = daysRes.rows;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Header */}
      <nav style={{
        background: 'rgba(11, 15, 25, 0.9)',
        borderBottom: '1px solid var(--border)',
        padding: '1.25rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--primary), var(--accent-teal))',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800
            }}>
              <i className="fa-solid fa-compass" style={{ color: '#FFF' }}></i>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>VaniTravels Portal</span>
          </div>
          <div>
            <span className="badge badge-converted">Official Itinerary</span>
          </div>
        </div>
      </nav>

      {/* Guest View Area */}
      <main style={{ flexGrow: 1, maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem', width: '100%' }} className="animate-fade-in">
        
        {/* Itinerary Summary Header Card */}
        <section className="glass-card" style={{ 
          marginBottom: '2.5rem', 
          background: 'linear-gradient(135deg, rgba(21, 28, 44, 0.9) 0%, rgba(31, 42, 63, 0.9) 100%)',
          borderLeft: '4px solid var(--primary)',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{itinerary.title}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                Prepared for <strong style={{ color: '#FFF' }}>{lead.client_name}</strong> • {lead.num_travelers} Guest(s)
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL PACKAGE PRICE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', fontFamily: 'Outfit' }}>
                {itinerary.price > 0 ? `Rs. ${itinerary.price}` : 'Quote Pending'}
              </div>
            </div>
          </div>

          {/* Details Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>SCHEDULE</span>
              <strong>{lead.travel_dates || 'Flexible Schedules'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>DURATION</span>
              <strong>{itinerary.total_days} Days / {itinerary.total_days - 1} Nights</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>ITINERARY STATUS</span>
              <span className={`badge badge-converted`} style={{ marginTop: '0.2rem' }}>Confirmed & Active</span>
            </div>
          </div>
        </section>

        {/* Day-by-Day Timeline */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2.5rem' }}>
            <i className="fa-solid fa-calendar-days" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
            Day-by-Day Travel Program
          </h2>

          {days.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <p>No details added to this itinerary yet. Check back soon!</p>
            </div>
          ) : (
            <div className="timeline">
              {days.map((day) => (
                <div key={day.id} className="timeline-item active" style={{ paddingLeft: '1rem' }}>
                  <div className="timeline-title" style={{ fontSize: '1.2rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Day {day.day_number}: Program</span>
                    {lead.start_date && (
                      <span className="badge badge-completed" style={{ textTransform: 'none', fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
                        {getFormattedDateForDay(lead.start_date, day.day_number)}
                      </span>
                    )}
                  </div>
                  
                  {/* Activities tags chips */}
                  {day.activities && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {day.activities.split(',').map((act, i) => (
                        <span key={i} className="badge badge-new" style={{ textTransform: 'none', background: 'rgba(99,102,241,0.08)', color: '#A5B4FC' }}>
                          {act.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="timeline-desc" style={{ lineHeight: '1.6', marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.975rem' }}>
                    {day.description || 'Program activities details are being finalized.'}
                  </p>

                  {/* Assigned Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    
                    {/* Hotel Stays Card */}
                    {day.hotel_name && (
                      <div style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          background: 'rgba(16,185,129,0.1)',
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          fontSize: '1.2rem'
                        }}>
                          <i className="fa-solid fa-bed"></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACCOMMODATION CHECK-IN</div>
                          <div style={{ fontWeight: '600', color: '#FFF', fontSize: '0.9rem' }}>{day.hotel_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{day.hotel_location || 'Lakeside Area'}</div>
                        </div>
                      </div>
                    )}

                    {/* Driver Logistics Card */}
                    {day.driver_name && (
                      <div style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          background: 'rgba(99,102,241,0.1)',
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--secondary)',
                          fontSize: '1.2rem'
                        }}>
                          <i className="fa-solid fa-taxi"></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LOGISTICS / VEHICLE DISPATCH</div>
                          <div style={{ fontWeight: '600', color: '#FFF', fontSize: '0.9rem' }}>
                            {day.driver_name} • <a href={`tel:${day.driver_phone}`} style={{ color: 'var(--secondary)', textDecoration: 'underline' }}>{day.driver_phone}</a>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {day.vehicle_model} ({day.vehicle_number})
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Accept Quotation Panel */}
        <AcceptQuotationButton itineraryId={itineraryId} initialStatus={lead.status} />

        {/* Dynamic Help Section */}
        <section className="glass-card text-center" style={{ marginTop: '4rem', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Need assistance during your trip?</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Our operations center is active 24/7. Click below to chat with VaniTravels support instantly.
          </p>
          <a 
            href={`https://wa.me/919876543210?text=Hi%20VaniTravels,%20I%20have%20an%20inquiry%20regarding%20my%20itinerary%20(ID:%20${itineraryId})`}
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            <i className="fa-brands fa-whatsapp"></i> Chat Support Live
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        marginTop: '5rem'
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <p>© 2026 VaniTravels Portal. Day-by-day guest planner updates dynamically.</p>
        </div>
      </footer>
    </div>
  );
}
