import { query } from '@/lib/db';

export class TemplateModel {
  static async getAll() {
    const res = await query('SELECT * FROM itinerary_templates ORDER BY id ASC');
    return res.rows;
  }

  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM itinerary_templates WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create({ name, region, totalDays, estimatedPrice, days }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO itinerary_templates (name, region, total_days, estimated_price, days)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, region, totalDays, estimatedPrice, days]
    );
    return res.rows[0];
  }

  static async update(id, { name, region, totalDays, estimatedPrice, days }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `UPDATE itinerary_templates 
       SET name = $1, region = $2, total_days = $3, estimated_price = $4, days = $5
       WHERE id = $6
       RETURNING *`,
      [name, region, totalDays, estimatedPrice, days, id]
    );
    return res.rows[0] || null;
  }

  static async delete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      'DELETE FROM itinerary_templates WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0] || null;
  }
}
