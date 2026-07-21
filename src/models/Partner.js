import { query } from '@/lib/db';

export class PartnerModel {
  static async getByUsername(username) {
    const res = await query('SELECT * FROM partners WHERE username = $1', [username]);
    return res.rows[0] || null;
  }

  static async getById(id) {
    const res = await query(
      'SELECT id, username, hotel_name, contact, commission_rate, created_at FROM partners WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  static async getAll() {
    const res = await query('SELECT id, hotel_name, commission_rate FROM partners ORDER BY hotel_name ASC');
    return res.rows;
  }
}
