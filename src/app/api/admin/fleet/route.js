import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { autoCompleteEndedJourneys } from '../leads/route';

function getIsoDateForDay(startDateStr, dayNum) {
  if (!startDateStr) return '';
  let dateStr = startDateStr;
  if (startDateStr instanceof Date) {
    const y = startDateStr.getFullYear();
    const m = String(startDateStr.getMonth() + 1).padStart(2, '0');
    const d = String(startDateStr.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }
  const parts = String(dateStr).substring(0, 10).split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  date.setDate(date.getDate() + (dayNum - 1));
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    // Auto-complete any converted journeys that have ended
    await autoCompleteEndedJourneys();

    // 1. Fetch all drivers/vehicles
    const driversRes = await query('SELECT * FROM drivers_registry ORDER BY driver_name ASC');
    const drivers = driversRes.rows;

    // 2. Fetch all active itinerary days where a driver is assigned
    // We only fetch for active/quoted/converted leads with valid start dates
    const bookingsRes = await query(`
      SELECT 
        id_day.driver_id, 
        id_day.day_number, 
        l.id as lead_id, 
        l.client_name, 
        l.client_phone, 
        l.start_date, 
        l.status as lead_status,
        i.id as itinerary_id, 
        i.title as itinerary_title, 
        i.price as itinerary_price,
        i.total_days
      FROM itinerary_days id_day
      JOIN itineraries i ON id_day.itinerary_id = i.id
      JOIN leads l ON i.lead_id = l.id
      WHERE id_day.driver_id IS NOT NULL 
        AND l.status IN ('new', 'quoted', 'converted')
        AND l.start_date IS NOT NULL
    `);
    const bookingRows = bookingsRes.rows;

    // 3. Process bookings and assign them to drivers
    const fleet = drivers.map(driver => {
      const driverBookings = [];

      // Find all booking rows for this driver
      bookingRows.forEach(row => {
        if (row.driver_id === driver.id) {
          try {
            const formattedDate = getIsoDateForDay(row.start_date, row.day_number);
            if (formattedDate) {
              driverBookings.push({
                date: formattedDate,
                lead_id: row.lead_id,
                client_name: row.client_name,
                client_phone: row.client_phone,
                lead_status: row.lead_status,
                itinerary_id: row.itinerary_id,
                itinerary_title: row.itinerary_title,
                itinerary_price: row.itinerary_price,
                day_number: row.day_number,
                start_date: row.start_date,
                total_days: row.total_days
              });
            }
          } catch (e) {
            console.error('Error parsing booking date:', e);
          }
        }
      });

      // Determine today's status
      const today = new Date();
      const tYear = today.getFullYear();
      const tMonth = String(today.getMonth() + 1).padStart(2, '0');
      const tDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${tYear}-${tMonth}-${tDay}`;

      // A driver is busy today if they have a confirmed booking (or even quoted) today
      // Priority: 'converted' booking indicates vehicle is active/on work.
      const todayBooking = driverBookings.find(b => b.date === todayStr);

      return {
        ...driver,
        bookings: driverBookings,
        todayBooking: todayBooking || null
      };
    });

    return NextResponse.json({
      success: true,
      fleet
    });
  } catch (error) {
    console.error('Fetch fleet scheduling API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
