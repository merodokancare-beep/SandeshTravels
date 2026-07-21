import { query } from '@/lib/db';

export class AdminModel {
  static async getByUsername(username) {
    const res = await query('SELECT * FROM admins WHERE username = $1', [username]);
    return res.rows[0] || null;
  }
}
