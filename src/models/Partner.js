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
    const res = await query(
      'SELECT id, hotel_name, contact, commission_rate, username, created_at FROM partners ORDER BY hotel_name ASC'
    );
    return res.rows;
  }

  static async create({ hotelName, contact, commissionRate, username, password }) {
    const res = await query(
      `INSERT INTO partners (hotel_name, contact, commission_rate, username, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, hotel_name, contact, commission_rate, username, created_at`,
      [hotelName, contact || null, commissionRate || 10, username, password]
    );
    return res.rows[0];
  }

  static async update(id, { hotelName, contact, commissionRate }) {
    const res = await query(
      `UPDATE partners
       SET hotel_name = $1, contact = $2, commission_rate = $3
       WHERE id = $4
       RETURNING id, hotel_name, contact, commission_rate, username, created_at`,
      [hotelName, contact || null, commissionRate || 10, id]
    );
    return res.rows[0] || null;
  }

  static async delete(id) {
    const res = await query(
      'DELETE FROM partners WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows[0] || null;
  }
}

