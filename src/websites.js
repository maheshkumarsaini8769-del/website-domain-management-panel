const express = require('express');
const router = express.Router();
const {
  Website,
  getDashboardStats,
  formatWebsiteDoc,
  normalizeUrl,
  calculateExpiryDate
} = require('./mongo');
const { requireAuth } = require('./auth');

// All website and dashboard routes require authentication
router.use(requireAuth);

// GET /api/websites/dashboard & /api/websites/dashboard/stats
router.get(['/dashboard', '/dashboard/stats'], async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to calculate dashboard statistics.' });
  }
});

// GET /api/websites
router.get('/', async (req, res) => {
  try {
    const {
      search,
      expiry_filter,
      sale_status,
      admin_access,
      date_type = 'built',
      date_from,
      date_to,
      min_payment,
      max_payment,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const allDocs = await Website.find({}).lean();
    let records = allDocs.map(formatWebsiteDoc);

    // Apply Search Filter (Case-insensitive)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(item => {
        const adminText = item.admin_access_given ? 'yes admin given' : 'no admin not given';
        const fieldsToSearch = [
          item.website_name,
          item.website_url,
          item.client_name,
          item.contact_info,
          item.website_built_date,
          item.domain_purchase_date,
          item.domain_registrar,
          item.domain_expiry_date,
          item.payment_date,
          item.payment_notes,
          item.sale_status,
          item.admin_name,
          item.expiry_status,
          adminText,
          item.notes,
          String(item.total_price),
          String(item.payment_received),
          String(item.pending_amount),
          item.selling_price ? String(item.selling_price) : ''
        ].filter(Boolean);

        return fieldsToSearch.some(field => field.toLowerCase().includes(q));
      });
    }

    // Filter: Expiry status
    if (expiry_filter && expiry_filter !== 'all') {
      if (expiry_filter === 'expiring_30') {
        records = records.filter(item => item.days_remaining !== null && item.days_remaining >= 0 && item.days_remaining <= 30);
      } else if (expiry_filter === 'expired') {
        records = records.filter(item => item.days_remaining !== null && item.days_remaining < 0);
      } else if (expiry_filter === 'active') {
        records = records.filter(item => item.days_remaining !== null && item.days_remaining > 30);
      }
    }

    // Filter: Sale status
    if (sale_status && sale_status !== 'all') {
      records = records.filter(item => item.sale_status === sale_status);
    }

    // Filter: Admin access
    if (admin_access && admin_access !== 'all') {
      if (admin_access === 'yes') {
        records = records.filter(item => item.admin_access_given === true);
      } else if (admin_access === 'no') {
        records = records.filter(item => item.admin_access_given === false);
      }
    }

    // Filter: Date range
    if (date_from || date_to) {
      let dateField = 'website_built_date';
      if (date_type === 'purchase') dateField = 'domain_purchase_date';
      else if (date_type === 'expiry') dateField = 'domain_expiry_date';
      else if (date_type === 'payment') dateField = 'payment_date';

      records = records.filter(item => {
        const val = item[dateField];
        if (!val) return false;
        if (date_from && val < date_from) return false;
        if (date_to && val > date_to) return false;
        return true;
      });
    }

    // Filter: Payment amount range
    if (min_payment !== undefined && min_payment !== '') {
      const min = parseFloat(min_payment);
      if (!isNaN(min)) {
        records = records.filter(item => item.payment_received >= min);
      }
    }
    if (max_payment !== undefined && max_payment !== '') {
      const max = parseFloat(max_payment);
      if (!isNaN(max)) {
        records = records.filter(item => item.payment_received <= max);
      }
    }

    // Sorting
    const isAsc = String(sort_order).toLowerCase() === 'asc';
    records.sort((a, b) => {
      let aVal = a[sort_by] !== undefined ? a[sort_by] : '';
      let bVal = b[sort_by] !== undefined ? b[sort_by] : '';
      if (typeof aVal === 'string') {
        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return isAsc ? aVal - bVal : bVal - aVal;
    });

    res.json({
      records,
      count: records.length,
      filters: {
        search: search || '',
        expiry_filter: expiry_filter || 'all',
        sale_status: sale_status || 'all',
        admin_access: admin_access || 'all'
      }
    });
  } catch (err) {
    console.error('Error fetching websites:', err);
    res.status(500).json({ error: 'Failed to retrieve website records.' });
  }
});

// GET /api/websites/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const allDocs = await Website.find({}).lean();
    const records = allDocs.map(formatWebsiteDoc);
    const headers = [
      'ID',
      'Website Name',
      'Website URL',
      'Client Name',
      'Contact Info',
      'Built Date',
      'Domain Purchase Date',
      'Registrar',
      'Duration (Years)',
      'Domain Expiry Date',
      'Days Remaining',
      'Expiry Status',
      'Total Price (INR)',
      'Payment Received (INR)',
      'Pending Amount (INR)',
      'Payment Date',
      'Payment Notes',
      'Sale Status',
      'Selling Price',
      'Sold Date',
      'Admin Access Given',
      'Admin Name',
      'Admin Given Date',
      'Notes',
      'Created At'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const text = String(str).replace(/"/g, '""');
      return `"${text}"`;
    };

    const rows = records.map(r => [
      r.id,
      escapeCsv(r.website_name),
      escapeCsv(r.website_url),
      escapeCsv(r.client_name),
      escapeCsv(r.contact_info),
      escapeCsv(r.website_built_date),
      escapeCsv(r.domain_purchase_date),
      escapeCsv(r.domain_registrar),
      r.domain_duration_years,
      escapeCsv(r.domain_expiry_date),
      r.days_remaining !== null ? r.days_remaining : '',
      escapeCsv(r.expiry_status),
      r.total_price,
      r.payment_received,
      r.pending_amount,
      escapeCsv(r.payment_date),
      escapeCsv(r.payment_notes),
      escapeCsv(r.sale_status),
      r.selling_price || '',
      escapeCsv(r.sold_date),
      r.admin_access_given ? 'Yes' : 'No',
      escapeCsv(r.admin_name),
      escapeCsv(r.admin_given_date),
      escapeCsv(r.notes),
      escapeCsv(r.created_at)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="websites-domains-export.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Failed to export records to CSV.' });
  }
});

// GET /api/websites/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await Website.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    res.json(formatWebsiteDoc(doc));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record.' });
  }
});

// POST /api/websites
router.post('/', async (req, res) => {
  try {
    const {
      website_name,
      website_url,
      client_name,
      contact_info,
      website_built_date,
      domain_purchase_date,
      domain_registrar,
      domain_duration_years = 1,
      domain_expiry_date,
      total_price = 0,
      payment_received = 0,
      payment_date,
      payment_notes,
      sale_status = 'Not for Sale',
      selling_price,
      sold_date,
      admin_access_given = 0,
      admin_name,
      admin_given_date,
      notes
    } = req.body;

    if (!website_name || !website_name.trim()) {
      return res.status(400).json({ error: 'Website name is required.' });
    }
    if (!website_url || !website_url.trim()) {
      return res.status(400).json({ error: 'Website URL is required.' });
    }
    if (!client_name || !client_name.trim()) {
      return res.status(400).json({ error: 'Client / Owner name is required.' });
    }

    const numTotalPrice = Math.max(0, parseFloat(total_price) || 0);
    const numPaymentReceived = Math.max(0, parseFloat(payment_received) || 0);
    const numPending = Math.max(0, numTotalPrice - numPaymentReceived);

    let finalExpiryDate = domain_expiry_date ? domain_expiry_date.trim() : '';
    if (!finalExpiryDate && domain_purchase_date) {
      finalExpiryDate = calculateExpiryDate(domain_purchase_date, domain_duration_years);
    }

    const cleanUrl = normalizeUrl(website_url);

    const newDoc = await Website.create({
      website_name: website_name.trim(),
      website_url: cleanUrl,
      client_name: client_name.trim(),
      contact_info: contact_info ? contact_info.trim() : null,
      website_built_date: website_built_date || null,
      domain_purchase_date: domain_purchase_date || null,
      domain_registrar: domain_registrar ? domain_registrar.trim() : null,
      domain_duration_years: parseInt(domain_duration_years, 10) || 1,
      domain_expiry_date: finalExpiryDate || null,
      total_price: numTotalPrice,
      payment_received: numPaymentReceived,
      pending_amount: numPending,
      payment_date: payment_date || null,
      payment_notes: payment_notes ? payment_notes.trim() : null,
      sale_status: sale_status || 'Not for Sale',
      selling_price: selling_price !== undefined && selling_price !== '' && selling_price !== null ? parseFloat(selling_price) : null,
      sold_date: sold_date || null,
      admin_access_given: Boolean(admin_access_given),
      admin_name: admin_name ? admin_name.trim() : null,
      admin_given_date: admin_given_date || null,
      notes: notes ? notes.trim() : null,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({
      message: 'Website record created successfully in MongoDB Atlas!',
      record: formatWebsiteDoc(newDoc)
    });
  } catch (err) {
    console.error('Error creating website:', err);
    res.status(500).json({ error: 'Failed to create website record.' });
  }
});

// PUT /api/websites/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await Website.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const {
      website_name,
      website_url,
      client_name,
      contact_info,
      website_built_date,
      domain_purchase_date,
      domain_registrar,
      domain_duration_years,
      domain_expiry_date,
      total_price,
      payment_received,
      payment_date,
      payment_notes,
      sale_status,
      selling_price,
      sold_date,
      admin_access_given,
      admin_name,
      admin_given_date,
      notes
    } = req.body;

    if (!website_name || !website_name.trim()) {
      return res.status(400).json({ error: 'Website name is required.' });
    }
    if (!website_url || !website_url.trim()) {
      return res.status(400).json({ error: 'Website URL is required.' });
    }
    if (!client_name || !client_name.trim()) {
      return res.status(400).json({ error: 'Client / Owner name is required.' });
    }

    const numTotalPrice = Math.max(0, parseFloat(total_price !== undefined ? total_price : existing.total_price) || 0);
    const numPaymentReceived = Math.max(0, parseFloat(payment_received !== undefined ? payment_received : existing.payment_received) || 0);
    const numPending = Math.max(0, numTotalPrice - numPaymentReceived);

    const cleanUrl = normalizeUrl(website_url);

    let finalExpiry = domain_expiry_date;
    if (!finalExpiry && domain_purchase_date) {
      finalExpiry = calculateExpiryDate(domain_purchase_date, domain_duration_years || existing.domain_duration_years);
    }

    existing.website_name = website_name.trim();
    existing.website_url = cleanUrl;
    existing.client_name = client_name.trim();
    existing.contact_info = contact_info ? contact_info.trim() : null;
    existing.website_built_date = website_built_date || null;
    existing.domain_purchase_date = domain_purchase_date || null;
    existing.domain_registrar = domain_registrar ? domain_registrar.trim() : null;
    existing.domain_duration_years = parseInt(domain_duration_years, 10) || 1;
    existing.domain_expiry_date = finalExpiry || null;
    existing.total_price = numTotalPrice;
    existing.payment_received = numPaymentReceived;
    existing.pending_amount = numPending;
    existing.payment_date = payment_date || null;
    existing.payment_notes = payment_notes ? payment_notes.trim() : null;
    existing.sale_status = sale_status || 'Not for Sale';
    existing.selling_price = selling_price !== undefined && selling_price !== '' && selling_price !== null ? parseFloat(selling_price) : null;
    existing.sold_date = sold_date || null;
    existing.admin_access_given = Boolean(admin_access_given);
    existing.admin_name = admin_name ? admin_name.trim() : null;
    existing.admin_given_date = admin_given_date || null;
    existing.notes = notes ? notes.trim() : null;
    existing.updated_at = new Date();

    await existing.save();

    res.json({
      message: 'Website record updated successfully in MongoDB Atlas!',
      record: formatWebsiteDoc(existing)
    });
  } catch (err) {
    console.error('Error updating website:', err);
    res.status(500).json({ error: 'Failed to update website record.' });
  }
});

// DELETE /api/websites/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await Website.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    await Website.findByIdAndDelete(req.params.id);
    res.json({ message: `Record for "${existing.website_name}" deleted successfully from MongoDB Atlas.` });
  } catch (err) {
    console.error('Error deleting website:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

module.exports = router;
