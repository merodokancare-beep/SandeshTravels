import { query } from '@/lib/db';

export class PaymentModel {
  static async create({
    leadId,
    paymentType,
    title,
    amount,
    paymentMethod = 'cash',
    transactionRef = '',
    paymentDate = new Date(),
    recordedBy = 1,
    recordedByName = 'Admin',
    notes = ''
  }) {
    const res = await query(`
      INSERT INTO lead_payments (
        lead_id, payment_type, title, amount, payment_method,
        transaction_ref, payment_date, recorded_by, recorded_by_name, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      leadId,
      paymentType,
      title,
      parseFloat(amount) || 0,
      paymentMethod || 'cash',
      transactionRef || '',
      paymentDate || new Date(),
      parseInt(recordedBy, 10) || 1,
      recordedByName || 'Admin',
      notes || ''
    ]);
    return res.rows[0];
  }

  static async getByLeadId(leadId) {
    const res = await query(`
      SELECT * FROM lead_payments
      WHERE lead_id = $1
      ORDER BY payment_date ASC, id ASC
    `, [leadId]);
    return res.rows;
  }

  static async deleteSettlements(leadId) {
    const res = await query(`
      DELETE FROM lead_payments
      WHERE lead_id = $1 AND payment_type IN ('installment', 'settlement')
      RETURNING *
    `, [leadId]);
    return res.rows;
  }
}
