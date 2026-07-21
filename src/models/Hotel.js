import { query } from '@/lib/db';

export class HotelModel {
  static async getAll() {
    const res = await query('SELECT * FROM hotels_registry ORDER BY name ASC');
    return res.rows;
  }

  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM hotels_registry WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create({ name, location, contact }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO hotels_registry (name, location, contact)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, location || null, contact || null]
    );
    return res.rows[0];
  }

  static async checkActiveStayExists(leadId, hotelId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      'SELECT id FROM active_stays WHERE lead_id = $1 AND hotel_id = $2',
      [leadId, hotelId]
    );
    return res.rows.length > 0;
  }

  static async createActiveStay(leadId, hotelId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO active_stays (lead_id, hotel_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [leadId, hotelId]
    );
    return res.rows[0];
  }
}
