import { NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

function parseLocalDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  const parts = String(dateInput).substring(0, 10).split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

export async function autoCompleteEndedJourneys() {
  try {
    const activeRes = await query(`
      SELECT l.id as lead_id, l.start_date, i.total_days, i.id as itinerary_id
      FROM leads l
      JOIN itineraries i ON l.id = i.lead_id
      WHERE l.status = 'converted' AND l.start_date IS NOT NULL
    `);

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const row of activeRes.rows) {
      // Only auto-complete if a driver/vehicle was actually assigned (it was a real active journey)
      const driverCheck = await query(
        `SELECT COUNT(*) as count FROM itinerary_days WHERE itinerary_id = $1 AND driver_id IS NOT NULL`,
        [row.itinerary_id]
      );
      const hasDriver = parseInt(driverCheck.rows[0].count, 10) > 0;
      if (!hasDriver) continue;

      const localStart = parseLocalDate(row.start_date);
      if (!localStart) continue;

      const totalDays = parseInt(row.total_days, 10) || 1;
      const localEnd = new Date(localStart);
      localEnd.setDate(localStart.getDate() + totalDays - 1);

      if (todayZero > localEnd) {
        await query(
          `UPDATE leads 
           SET status = 'completed' 
           WHERE id = $1`,
          [row.lead_id]
        );
        console.log(`[Auto-Complete] Lead ${row.lead_id} marked COMPLETED. Journey ended on ${localEnd.toLocaleDateString()}`);
      }
    }
  } catch (err) {
    console.error('Error in autoCompleteEndedJourneys:', err);
  }
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

    // Select all leads with the partner details if applicable
    const res = await query(
      `SELECT l.*, p.hotel_name as partner_name, p.commission_rate
       FROM leads l
       LEFT JOIN partners p ON l.partner_id = p.id
       ORDER BY l.created_at DESC`
    );

    return NextResponse.json({
      success: true,
      leads: res.rows
    });
  } catch (error) {
    console.error('Admin fetch leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  const client = await getClient();
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const { leadId, status, startDate } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Update status and/or start_date in db
    let res;
    if (status !== undefined && startDate !== undefined) {
      res = await client.query(
        `UPDATE leads 
         SET status = $1, start_date = $2 
         WHERE id = $3 
         RETURNING *`,
        [status, startDate || null, leadId]
      );
    } else if (status !== undefined) {
      res = await client.query(
        `UPDATE leads 
         SET status = $1 
         WHERE id = $2 
         RETURNING *`,
        [status, leadId]
      );
    } else if (startDate !== undefined) {
      res = await client.query(
        `UPDATE leads 
         SET start_date = $1 
         WHERE id = $2 
         RETURNING *`,
        [startDate || null, leadId]
      );
    } else {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Nothing to update.' },
        { status: 400 }
      );
    }

    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Lead not found.' },
        { status: 404 }
      );
    }

    const updatedLead = res.rows[0];

    // If lead status is converted, check for scheduling conflicts
    if (updatedLead.status === 'converted') {
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
          AND l_other.id != $1
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
          { error: `Cannot confirm booking: Driver "${firstConflict.driver_name}" has a conflict with confirmed guest "${firstConflict.other_client_name}" on ${dateStr}. Please change the driver in Itinerary Builder first.` },
          { status: 400 }
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      lead: updatedLead
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin update lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
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

    const { clientName, clientPhone, travelDates, numTravelers, startDate, templateId, partnerId } = await request.json();

    if (!clientName || !clientPhone) {
      return NextResponse.json(
        { error: 'Client name and phone number are required.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Insert new lead
    const guestsCount = parseInt(numTravelers, 10) || 1;
    const initialStatus = templateId ? 'quoted' : 'new';
    const parsedPartnerId = partnerId ? parseInt(partnerId, 10) : null;

    const leadRes = await client.query(
      `INSERT INTO leads (partner_id, client_name, client_phone, travel_dates, num_travelers, status, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [parsedPartnerId, clientName, clientPhone, travelDates || null, guestsCount, initialStatus, startDate || null]
    );
    const lead = leadRes.rows[0];

    // 2. If a template is selected, generate the itinerary and days
    if (templateId) {
      const templateRes = await client.query(
        'SELECT * FROM itinerary_templates WHERE id = $1',
        [parseInt(templateId, 10)]
      );

      if (templateRes.rows.length > 0) {
        const template = templateRes.rows[0];
        
        // Create Itinerary
        const itinRes = await client.query(
          `INSERT INTO itineraries (lead_id, title, price, total_days, status)
           VALUES ($1, $2, $3, $4, 'draft')
           RETURNING id`,
          [lead.id, `${template.name} for ${clientName}`, template.estimated_price, template.total_days]
        );
        const itineraryId = itinRes.rows[0].id;

        // Create Itinerary Days
        // Days in database are stored in JSONB for templates: e.g. [{ dayNumber: 1, description: '...', activities: '...' }]
        const templateDays = typeof template.days === 'string' ? JSON.parse(template.days) : template.days;
        
        for (const day of templateDays) {
          await client.query(
            `INSERT INTO itinerary_days (itinerary_id, day_number, hotel_id, driver_id, description, activities)
             VALUES ($1, $2, NULL, NULL, $3, $4)`,
            [itineraryId, day.dayNumber, day.description || '', day.activities || '']
          );
        }
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      lead
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin create lead API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during booking creation.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
