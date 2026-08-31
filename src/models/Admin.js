import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export class AdminModel {
  static async getByUsername(username) {
    const res = await query('SELECT * FROM admins WHERE username = $1', [username]);
    return res.rows[0] || null;
  }

  static async getById(id) {
    const res = await query(
      'SELECT id, username, name, role, modules, phone, is_active, created_at FROM admins WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  static async getAll() {
    const res = await query(
      'SELECT id, username, name, role, modules, phone, is_active, created_at FROM admins ORDER BY id ASC'
    );
    return res.rows;
  }

  static async create({ username, password, name, role = 'employee', modules = ['crm', 'itinerary'], phone = '', isActive = true }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const modulesJson = JSON.stringify(modules);
    const res = await query(
      `INSERT INTO admins (username, password, name, role, modules, phone, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id, username, name, role, modules, phone, is_active, created_at`,
      [username.trim(), hashedPassword, name.trim(), role, modulesJson, phone ? phone.trim() : '', isActive]
    );
    return res.rows[0];
  }

  static async update(id, { name, username, password, role, modules, phone, isActive }) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (username !== undefined) {
      updates.push(`username = $${idx++}`);
      values.push(username.trim());
    }
    if (password && password.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      updates.push(`password = $${idx++}`);
      values.push(hashedPassword);
    }
    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (modules !== undefined) {
      updates.push(`modules = $${idx++}::jsonb`);
      values.push(JSON.stringify(modules));
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(phone ? phone.trim() : '');
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(Boolean(isActive));
    }

    if (updates.length === 0) return null;

    values.push(id);
    const res = await query(
      `UPDATE admins 
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, username, name, role, modules, phone, is_active, created_at`,
      values
    );
    return res.rows[0] || null;
  }

  static async delete(id) {
    const res = await query('DELETE FROM admins WHERE id = $1 RETURNING id', [id]);
    return res.rows[0] || null;
  }
}

