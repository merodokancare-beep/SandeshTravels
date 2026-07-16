import { NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required.' },
        { status: 400 }
      );
    }

    // 0. Fetch lead details
    const leadRes = await query(
      `SELECT l.*, p.hotel_name as partner_name 
       FROM leads l 
       LEFT JOIN partners p ON l.partner_id = p.id 
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Lead not found.' },
        { status: 404 }
      );
    }
    const lead = leadRes.rows[0];

    // 1. Fetch itinerary
    const itineraryRes = await query(
      'SELECT * FROM itineraries WHERE lead_id = $1',
      [leadId]
    );

    if (itineraryRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        lead,
        itinerary: null,
        days: []
      });
    }

    const itinerary = itineraryRes.rows[0];

    // 2. Fetch days
    const daysRes = await query(
      'SELECT * FROM itinerary_days WHERE itinerary_id = $1 ORDER BY day_number ASC',
      [itinerary.id]
    );

    return NextResponse.json({
      success: true,
      lead,
      itinerary,
      days: daysRes.rows
    });
  } catch (error) {
    console.error('Fetch itinerary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const client = await getClient();
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const { leadId, title, price, totalDays, days, startDate } = await request.json();

    if (!leadId || !title || !totalDays) {
      return NextResponse.json(
        { error: 'Lead ID, title, and total days are required.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Update start_date in leads table
    await client.query(
      `UPDATE leads 
       SET start_date = $1 
       WHERE id = $2`,
      [startDate || null, leadId]
    );

    // 1. Check if itinerary exists for this lead
    let itineraryId;
    const existing = await client.query(
      'SELECT id FROM itineraries WHERE lead_id = $1',
      [leadId]
    );

    // Clean price string by stripping currency symbols ($, Rs., Rs), spaces, and commas
    const cleanPrice = String(price || '').replace(/[^0-9.]/g, '');
    const priceNum = parseFloat(cleanPrice) || 0.00;
    const daysCount = parseInt(totalDays, 10) || 1;

    if (existing.rows.length > 0) {
      // Update
      itineraryId = existing.rows[0].id;
      await client.query(
        `UPDATE itineraries 
         SET title = $1, price = $2, total_days = $3
         WHERE id = $4`,
        [title, priceNum, daysCount, itineraryId]
      );
    } else {
      // Create
      const newItin = await client.query(
        `INSERT INTO itineraries (lead_id, title, price, total_days, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING id`,
        [leadId, title, priceNum, daysCount]
      );
      itineraryId = newItin.rows[0].id;

      // Update lead status to 'quoted' if it's currently 'new'
      await client.query(
        `UPDATE leads 
         SET status = 'quoted' 
         WHERE id = $1 AND status = 'new'`,
        [leadId]
      );
    }

    // 2. Delete all existing days for this itinerary
    await client.query(
      'DELETE FROM itinerary_days WHERE itinerary_id = $1',
      [itineraryId]
    );

    // 3. Insert new days details
    for (const d of days) {
      const hotelId = d.hotelId ? parseInt(d.hotelId, 10) : null;
      const driverId = d.driverId ? parseInt(d.driverId, 10) : null;

      await client.query(
        `INSERT INTO itinerary_days (itinerary_id, day_number, hotel_id, driver_id, description, activities)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          itineraryId, 
          parseInt(d.dayNumber, 10), 
          hotelId || null, 
          driverId || null, 
          d.description || null, 
          d.activities || null
        ]
      );

      // Manage active stays/stages: if hotel check-in is assigned, create active stay tracker
      if (hotelId) {
        // Check if an active stay entry already exists for this lead + hotel combination
        const stayCheck = await client.query(
          'SELECT id FROM active_stays WHERE lead_id = $1 AND hotel_id = $2',
          [leadId, hotelId]
        );
        if (stayCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO active_stays (lead_id, hotel_id, status)
             VALUES ($1, $2, 'pending')`,
            [leadId, hotelId]
          );
        }
      }
    }

    // Verify driver scheduling conflicts if this is a confirmed journey
    const conflictRes = await client.query(`
      SELECT 
        d.driver_name,
        (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date as target_date,
        l_other.client_name as other_client_name
      FROM itinerary_days id_day
      JOIN itineraries i ON id_day.itinerary_id = i.id
      JOIN leads l_target ON i.lead_id = l_target.id
      JOIN drivers_registry d ON id_day.driver_id = d.id
      JOIN itinerary_days id_day_other ON id_day.driver_id = id_day_other.driver_id
      JOIN itineraries i_other ON id_day_other.itinerary_id = i_other.id
      JOIN leads l_other ON i_other.lead_id = l_other.id
      WHERE l_target.id = $1
        AND l_target.status = 'converted'
        AND l_other.id != l_target.id
        AND l_other.status = 'converted'
        AND l_target.start_date IS NOT NULL
        AND l_other.start_date IS NOT NULL
        AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
            (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
    `, [leadId]);

    if (conflictRes.rows.length > 0) {
      await client.query('ROLLBACK');
      const firstConflict = conflictRes.rows[0];
      const dateStr = new Date(firstConflict.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return NextResponse.json(
        { error: `Scheduling Conflict: Driver "${firstConflict.driver_name}" is already assigned to confirmed guest "${firstConflict.other_client_name}" on ${dateStr}. Please assign another driver.` },
        { status: 400 }
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      itineraryId,
      message: 'Itinerary saved successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save itinerary transaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error during database transaction.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
