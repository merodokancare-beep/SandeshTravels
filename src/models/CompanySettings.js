import { query } from '@/lib/db';

export class CompanySettingsModel {
  static async get() {
    const res = await query(`SELECT * FROM company_settings ORDER BY id ASC LIMIT 1`);
    if (res.rows[0]) return res.rows[0];

    // Fallback default
    return {
      company_name: 'M/s Sandesh Travels',
      tagline: 'Tours & Travel Company',
      phone: '+91 9647878373',
      email: 'santeshtravelsgtk@gmail.com',
      website: 'www.sandeshtravels.in',
      address: 'Chota Singtam, Near Kishan School, Aho Busty, Aho Yangtam GPU, Pakyong 737135',
      pan: 'AXXPR3863J',
      gstin: 'AXXPR3863J',
      license: 'TTD:1667/DoT &CAv/Gtk/24/TA | TL: EOG/AHY/0282',
      upi_id: '9647878373@upi',
      upi_payee_name: 'Sandesh Travels',
      advance_percentage: 10,
      bank_account_name: 'M/s Sandesh Travels',
      bank_name: 'State Bank of India',
      bank_branch: 'Pakyong / Gangtok Branch',
      bank_account_number: '412309876543',
      bank_ifsc: 'SBIN0001234',
      bank_account_type: 'Current Account'
    };
  }

  static async update(fields) {
    const current = await this.get();
    const id = current.id || 1;

    const {
      companyName,
      tagline,
      phone,
      email,
      website,
      address,
      pan,
      gstin,
      license,
      upiId,
      upiPayeeName,
      advancePercentage,
      bankAccountName,
      bankName,
      bankBranch,
      bankAccountNumber,
      bankIfsc,
      bankAccountType
    } = fields;

    const res = await query(`
      INSERT INTO company_settings (
        id, company_name, tagline, phone, email, website, address, pan, gstin, license,
        upi_id, upi_payee_name, advance_percentage, bank_account_name, bank_name,
        bank_branch, bank_account_number, bank_ifsc, bank_account_type, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET company_name = EXCLUDED.company_name,
          tagline = EXCLUDED.tagline,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          website = EXCLUDED.website,
          address = EXCLUDED.address,
          pan = EXCLUDED.pan,
          gstin = EXCLUDED.gstin,
          license = EXCLUDED.license,
          upi_id = EXCLUDED.upi_id,
          upi_payee_name = EXCLUDED.upi_payee_name,
          advance_percentage = EXCLUDED.advance_percentage,
          bank_account_name = EXCLUDED.bank_account_name,
          bank_name = EXCLUDED.bank_name,
          bank_branch = EXCLUDED.bank_branch,
          bank_account_number = EXCLUDED.bank_account_number,
          bank_ifsc = EXCLUDED.bank_ifsc,
          bank_account_type = EXCLUDED.bank_account_type,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      id,
      companyName || current.company_name,
      tagline || current.tagline,
      phone || current.phone,
      email || current.email,
      website || current.website,
      address || current.address,
      pan || current.pan,
      gstin || current.gstin,
      license || current.license,
      upiId || current.upi_id,
      upiPayeeName || current.upi_payee_name,
      advancePercentage !== undefined ? parseInt(advancePercentage, 10) : current.advance_percentage,
      bankAccountName || current.bank_account_name,
      bankName || current.bank_name,
      bankBranch || current.bank_branch,
      bankAccountNumber || current.bank_account_number,
      bankIfsc || current.bank_ifsc,
      bankAccountType || current.bank_account_type
    ]);

    return res.rows[0];
  }
}
