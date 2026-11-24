const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../data/websites.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_default_password INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Websites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS websites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_name TEXT NOT NULL,
      website_url TEXT NOT NULL,
      client_name TEXT NOT NULL,
      contact_info TEXT,
      website_built_date TEXT,
      domain_purchase_date TEXT,
      domain_registrar TEXT,
      domain_duration_years INTEGER DEFAULT 1,
      domain_expiry_date TEXT,
      total_price REAL DEFAULT 0,
      payment_received REAL DEFAULT 0,
      pending_amount REAL DEFAULT 0,
      payment_date TEXT,
      payment_notes TEXT,
      sale_status TEXT DEFAULT 'Not for Sale',
      selling_price REAL,
      sold_date TEXT,
      admin_access_given INTEGER DEFAULT 0,
      admin_name TEXT,
      admin_given_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create default admin user if not exists
  const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get('maheshsaini');
  if (!existingUser) {
    const saltRounds = 10;
    const defaultHash = bcrypt.hashSync('mahesh99830', saltRounds);
    db.prepare(`
      INSERT INTO users (username, password_hash, is_default_password)
      VALUES (?, ?, 1)
    `).run('maheshsaini', defaultHash);
    console.log('[DB] Initialized default admin user: maheshsaini');
  }
}

// Compute days remaining & status given domain_expiry_date (YYYY-MM-DD)
function computeExpiry(expiryDateStr) {
  if (!expiryDateStr) {
    return { days_remaining: null, expiry_status: 'Unknown' };
  }
  const today = new Date();
  const todayMidnight = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const parts = expiryDateStr.split('-');
  if (parts.length !== 3) {
    return { days_remaining: null, expiry_status: 'Unknown' };
  }
  const expDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  const diffTime = expDate.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let status = 'Active';
  if (diffDays < 0) {
    status = 'Expired';
  } else if (diffDays <= 30) {
    status = 'Expiring Soon';
  } else {
    status = 'Active';
  }

  return { days_remaining: diffDays, expiry_status: status };
}

// Calculate expiry date automatically from purchase date & duration in years
function calculateExpiryDate(purchaseDateStr, durationYears) {
  if (!purchaseDateStr) return '';
  const parts = purchaseDateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const duration = parseInt(durationYears, 10) || 1;
  const targetYear = y + duration;

  // Handle leap year (Feb 29 -> Feb 28 on non-leap year)
  const date = new Date(Date.UTC(targetYear, m - 1, d));
  return date.toISOString().split('T')[0];
}

// Format a single website row with calculated dynamic fields
function formatWebsiteRow(row) {
  if (!row) return null;
  const expiryInfo = computeExpiry(row.domain_expiry_date);
  const totalPrice = Number(row.total_price) || 0;
  const paymentReceived = Number(row.payment_received) || 0;
  const pendingAmount = Math.max(0, totalPrice - paymentReceived);

  return {
    ...row,
    total_price: totalPrice,
    payment_received: paymentReceived,
    pending_amount: pendingAmount,
    selling_price: row.selling_price !== null && row.selling_price !== undefined ? Number(row.selling_price) : null,
    admin_access_given: Boolean(row.admin_access_given),
    days_remaining: expiryInfo.days_remaining,
    expiry_status: expiryInfo.expiry_status
  };
}

// Get dashboard statistics
function getDashboardStats() {
  const allRows = db.prepare('SELECT * FROM websites').all().map(formatWebsiteRow);

  let total_websites = allRows.length;
  let total_for_sale = 0;
  let total_sold = 0;
  let total_payment_received = 0;
  let total_pending_payment = 0;
  let total_expiring_30_days = 0;
  let total_expired = 0;
  let total_active = 0;
  let total_admin_access_given = 0;
  let total_admin_access_not_given = 0;

  for (const item of allRows) {
    if (item.sale_status === 'For Sale') total_for_sale++;
    if (item.sale_status === 'Sold') total_sold++;
    total_payment_received += item.payment_received || 0;
    total_pending_payment += item.pending_amount || 0;

    if (item.days_remaining !== null) {
      if (item.days_remaining < 0) {
        total_expired++;
      } else if (item.days_remaining <= 30) {
        total_expiring_30_days++;
      } else {
        total_active++;
      }
    }

    if (item.admin_access_given) {
      total_admin_access_given++;
    } else {
      total_admin_access_not_given++;
    }
  }

  return {
    total_websites,
    total_for_sale,
    total_sold,
    total_payment_received,
    total_pending_payment,
    total_cleared_payment: total_payment_received, // Cleared/received total
    total_expiring_30_days,
    total_expired,
    total_active,
    total_admin_access_given,
    total_admin_access_not_given
  };
}

// Normalize URL (ensures http/https prefix for links)
function normalizeUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

module.exports = {
  db,
  initDb,
  computeExpiry,
  calculateExpiryDate,
  formatWebsiteRow,
  getDashboardStats,
  normalizeUrl
};
