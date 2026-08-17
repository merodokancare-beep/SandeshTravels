import { query } from '@/lib/db';

export class ItineraryModel {
  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM itineraries WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async getByLeadId(leadId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM itineraries WHERE lead_id = $1', [leadId]);
    return res.rows[0] || null;
  }

  static async create({ leadId, title, price, totalDays, status = 'draft' }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO itineraries (lead_id, title, price, total_days, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [leadId, title, price, totalDays, status]
    );
    return res.rows[0];
  }

  static async update(id, { title, price, totalDays }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `UPDATE itineraries 
       SET title = $1, price = $2, total_days = $3
       WHERE id = $4
       RETURNING *`,
      [title, price, totalDays, id]
    );
    return res.rows[0] || null;
  }

  static async getDays(itineraryId) {
    const res = await query(
      'SELECT * FROM itinerary_days WHERE itinerary_id = $1 ORDER BY day_number ASC',
      [itineraryId]
    );
    return res.rows;
  }

  static async getDaysWithDetails(itineraryId) {
    const res = await query(
      `SELECT id_day.*, 
              h.name as hotel_name, h.location as hotel_location, h.contact as hotel_contact,
              COALESCE(id_day.driver_name_snapshot, d.driver_name) AS driver_name,
              COALESCE(id_day.driver_phone_snapshot, d.driver_phone) AS driver_phone,
              COALESCE(id_day.vehicle_number_snapshot, d.vehicle_number) AS vehicle_number,
              COALESCE(id_day.vehicle_model_snapshot, d.vehicle_model) AS vehicle_model
       FROM itinerary_days id_day
       LEFT JOIN hotels_registry h ON id_day.hotel_id = h.id
       LEFT JOIN drivers_registry d ON id_day.driver_id = d.id
       WHERE id_day.itinerary_id = $1
       ORDER BY id_day.day_number ASC`,
      [itineraryId]
    );
    return res.rows;
  }

  static async deleteDays(itineraryId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q('DELETE FROM itinerary_days WHERE itinerary_id = $1', [itineraryId]);
  }

  static async createDay({ itineraryId, dayNumber, hotelId, driverId, description, activities }, client = null) {
    const q = client ? client.query.bind(client) : query;
    let driverNameSnap = null, driverPhoneSnap = null, vehNumSnap = null, vehModelSnap = null;
    if (driverId) {
      const driverRes = await q('SELECT * FROM drivers_registry WHERE id = $1', [driverId]);
      const d = driverRes.rows[0];
      if (d) {
        driverNameSnap = d.driver_name;
        driverPhoneSnap = d.driver_phone;
        vehNumSnap = d.vehicle_number;
        vehModelSnap = d.vehicle_model;
      }
    }
    const res = await q(
      `INSERT INTO itinerary_days (itinerary_id, day_number, hotel_id, driver_id, description, activities, driver_name_snapshot, driver_phone_snapshot, vehicle_number_snapshot, vehicle_model_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [itineraryId, dayNumber, hotelId || null, driverId || null, description || null, activities || null, driverNameSnap, driverPhoneSnap, vehNumSnap, vehModelSnap]
    );
    return res.rows[0];
  }

  static async updateDayDriver(itineraryId, dayNumber, driverId, client = null) {
    const q = client ? client.query.bind(client) : query;
    if (driverId) {
      const driverRes = await q('SELECT * FROM drivers_registry WHERE id = $1', [driverId]);
      const d = driverRes.rows[0];
      if (d) {
        await q(
          `UPDATE itinerary_days 
           SET driver_id = $1,
               driver_name_snapshot = $2,
               driver_phone_snapshot = $3,
               vehicle_number_snapshot = $4,
               vehicle_model_snapshot = $5
           WHERE itinerary_id = $6 AND day_number = $7`,
          [driverId, d.driver_name, d.driver_phone, d.vehicle_number, d.vehicle_model, itineraryId, dayNumber]
        );
        return;
      }
    }
    await q(
      `UPDATE itinerary_days 
       SET driver_id = NULL,
           driver_name_snapshot = NULL,
           driver_phone_snapshot = NULL,
           vehicle_number_snapshot = NULL,
           vehicle_model_snapshot = NULL
       WHERE itinerary_id = $1 AND day_number = $2`,
      [itineraryId, dayNumber]
    );
  }

  static async getConflictsByLeadId(leadId, client = null) {
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
        AND l_target.status = 'converted'
        AND l_other.id != l_target.id
        AND l_other.status = 'converted'
        AND l_target.start_date IS NOT NULL
        AND l_other.start_date IS NOT NULL
        AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
            (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
    `, [leadId]);
    return conflictRes.rows;
  }

  static async getConflictsByItineraryId(itineraryId, client = null) {
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
      WHERE i.id = $1
        AND l_target.status IN ('converted', 'assigned')
        AND l_other.id != l_target.id
        AND l_other.status IN ('converted', 'assigned')
        AND l_target.start_date IS NOT NULL
        AND l_other.start_date IS NOT NULL
        AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
            (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
    `, [itineraryId]);
    return conflictRes.rows;
  }

  static async unassignConflictingDrivers(itineraryId, leadId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(`
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
            AND l_other.status IN ('converted', 'assigned')
            AND l_target.start_date IS NOT NULL
            AND l_other.start_date IS NOT NULL
            AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
                (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
        )
    `, [itineraryId, leadId]);
  }

  static async getFirstAssignedDriver(itineraryId) {
    const res = await query(`
      SELECT id_day.*, d.driver_name, d.driver_phone, d.vehicle_model, d.vehicle_number
      FROM itinerary_days id_day
      LEFT JOIN drivers_registry d ON id_day.driver_id = d.id
      WHERE id_day.itinerary_id = $1 AND id_day.driver_id IS NOT NULL
      ORDER BY id_day.day_number ASC
      LIMIT 1
    `, [itineraryId]);
    return res.rows[0] || null;
  }
}
