import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { autoCompleteEndedJourneys } from '../leads/route';

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

    // Query converted and completed leads
    const leadsRes = await query(`
      SELECT l.*, i.id as itinerary_id, i.title as itinerary_title, i.price as itinerary_price, i.total_days,
             p.hotel_name as partner_name, p.commission_rate
      FROM leads l
      LEFT JOIN itineraries i ON l.id = i.lead_id
      LEFT JOIN partners p ON l.partner_id = p.id
      WHERE l.status IN ('converted', 'completed')
      ORDER BY l.start_date ASC, l.created_at DESC
    `);

    const journeys = [];

    for (const lead of leadsRes.rows) {
      if (!lead.itinerary_id) {
        journeys.push({
          lead,
          itinerary: null,
          days: []
        });
        continue;
      }

      const daysRes = await query(`
        SELECT id_day.*, 
               h.name as hotel_name, h.location as hotel_location, h.contact as hotel_contact,
               d.driver_name, d.driver_phone, d.vehicle_number, d.vehicle_model
        FROM itinerary_days id_day
        LEFT JOIN hotels_registry h ON id_day.hotel_id = h.id
        LEFT JOIN drivers_registry d ON id_day.driver_id = d.id
        WHERE id_day.itinerary_id = $1
        ORDER BY id_day.day_number ASC
      `, [lead.itinerary_id]);

      journeys.push({
        lead,
        itinerary: {
          id: lead.itinerary_id,
          title: lead.itinerary_title,
          price: lead.itinerary_price,
          total_days: lead.total_days
        },
        days: daysRes.rows
      });
    }

    return NextResponse.json({
      success: true,
      journeys
    });
  } catch (error) {
    console.error('Fetch tracking API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
