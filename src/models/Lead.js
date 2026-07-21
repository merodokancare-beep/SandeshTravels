import { query } from '@/lib/db';

export class LeadModel {
  static async getAll() {
    const res = await query(
      `SELECT l.*, p.hotel_name as partner_name, p.commission_rate
       FROM leads l
       LEFT JOIN partners p ON l.partner_id = p.id
       ORDER BY l.created_at DESC`
    );
    return res.rows;
  }

  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM leads WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async getByPartnerId(partnerId) {
    const res = await query(
      `SELECT * FROM leads 
       WHERE partner_id = $1 
       ORDER BY created_at DESC`,
      [partnerId]
    );
    return res.rows;
  }

  static async create({ partnerId, clientName, clientPhone, travelDates, numTravelers, status = 'new', startDate = null }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO leads (partner_id, client_name, client_phone, travel_dates, num_travelers, status, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [partnerId, clientName, clientPhone, travelDates || null, numTravelers, status, startDate]
    );
    return res.rows[0];
  }

  static async update(id, fields, client = null) {
    const q = client ? client.query.bind(client) : query;
    const { status, startDate } = fields;

    let res;
    if (status !== undefined && startDate !== undefined) {
      res = await q(
        `UPDATE leads 
         SET status = $1, start_date = $2 
         WHERE id = $3 
         RETURNING *`,
        [status, startDate || null, id]
      );
    } else if (status !== undefined) {
      res = await q(
        `UPDATE leads 
         SET status = $1 
         WHERE id = $2 
         RETURNING *`,
        [status, id]
      );
    } else if (startDate !== undefined) {
      res = await q(
        `UPDATE leads 
         SET start_date = $1 
         WHERE id = $2 
         RETURNING *`,
        [startDate || null, id]
      );
    } else {
      throw new Error('No fields provided to update lead');
    }

    return res.rows[0] || null;
  }

  static async getConflicts(leadId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const conflictRes = await q(`
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
    return conflictRes.rows;
  }

  static async autoCompleteEndedJourneys() {
    const activeRes = await query(`
      SELECT l.id as lead_id, l.start_date, i.total_days, i.id as itinerary_id
      FROM leads l
      JOIN itineraries i ON l.id = i.lead_id
      WHERE l.status = 'converted' AND l.start_date IS NOT NULL
    `);

    const parseLocalDate = (dateInput) => {
      if (!dateInput) return null;
      if (dateInput instanceof Date) {
        return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
      }
      const parts = String(dateInput).substring(0, 10).split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const row of activeRes.rows) {
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
  }

  static async getTrackingLeads() {
    const res = await query(`
      SELECT l.*, i.id as itinerary_id, i.title as itinerary_title, i.price as itinerary_price, i.total_days,
             p.hotel_name as partner_name, p.commission_rate
      FROM leads l
      LEFT JOIN itineraries i ON l.id = i.lead_id
      LEFT JOIN partners p ON l.partner_id = p.id
      WHERE l.status IN ('converted', 'completed')
      ORDER BY l.start_date ASC, l.created_at DESC
    `);
    return res.rows;
  }
}
