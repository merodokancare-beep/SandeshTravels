import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { itineraryId } = await request.json();

    if (!itineraryId) {
      return NextResponse.json(
        { error: 'Itinerary ID is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch the itinerary to find the associated lead_id
    const itinRes = await query(
      'SELECT lead_id FROM itineraries WHERE id = $1',
      [parseInt(itineraryId, 10)]
    );

    if (itinRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Itinerary not found.' },
        { status: 404 }
      );
    }

    const { lead_id } = itinRes.rows[0];

    // 2. Unassign any drivers assigned to this itinerary that conflict with existing confirmed (converted) bookings
    await query(`
      UPDATE itinerary_days
      SET driver_id = NULL
      WHERE itinerary_id = $1
        AND id IN (
          SELECT id_day.id
          FROM itinerary_days id_day
          JOIN itineraries i ON id_day.itinerary_id = i.id
          JOIN leads l_target ON i.lead_id = l_target.id
          JOIN itinerary_days id_day_other ON id_day.driver_id = id_day_other.driver_id
          JOIN itineraries i_other ON id_day_other.itinerary_id = i_other.id
          JOIN leads l_other ON i_other.lead_id = l_other.id
          WHERE l_target.id = $2
            AND l_other.id != $2
            AND l_other.status = 'converted'
            AND l_target.start_date IS NOT NULL
            AND l_other.start_date IS NOT NULL
            AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
                (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
        )
    `, [parseInt(itineraryId, 10), lead_id]);

    // 3. Update the lead status to 'converted'
    const leadRes = await query(
      `UPDATE leads 
       SET status = 'converted' 
       WHERE id = $1 
       RETURNING *`,
      [lead_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Itinerary accepted and lead converted successfully.',
      lead: leadRes.rows[0]
    });
  } catch (error) {
    console.error('Guest accept itinerary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
