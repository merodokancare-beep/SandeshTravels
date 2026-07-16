import { NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

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

    const { itineraryId, assignments } = await request.json();

    if (!itineraryId || !assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Itinerary ID and assignments array are required.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Update each day's driver_id
    for (const item of assignments) {
      await client.query(
        `UPDATE itinerary_days 
         SET driver_id = $1 
         WHERE itinerary_id = $2 AND day_number = $3`,
        [item.driverId ? parseInt(item.driverId, 10) : null, parseInt(itineraryId, 10), parseInt(item.dayNumber, 10)]
      );
    }

    // Check for double booking conflicts on the same date for confirmed journeys
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
      WHERE i.id = $1
        AND l_target.status = 'converted'
        AND l_other.id != l_target.id
        AND l_other.status = 'converted'
        AND l_target.start_date IS NOT NULL
        AND l_other.start_date IS NOT NULL
        AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
            (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
    `, [parseInt(itineraryId, 10)]);

    if (conflictRes.rows.length > 0) {
      await client.query('ROLLBACK');
      const firstConflict = conflictRes.rows[0];
      const dateStr = new Date(firstConflict.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return NextResponse.json(
        { error: `Scheduling Conflict: Driver "${firstConflict.driver_name}" already has a confirmed booking with guest "${firstConflict.other_client_name}" on ${dateStr}. Please assign another driver.` },
        { status: 400 }
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Fleet assigned successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign fleet API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
