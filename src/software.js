const express = require('express');
const router = express.Router();
const { SoftwareApp, formatSoftwareAppDoc } = require('./mongo');
const { requireAuth } = require('./auth');

// All software routes require authentication
router.use(requireAuth);

// GET /api/software
router.get('/', async (req, res) => {
  try {
    const { search, category, status, sort_by = 'created_at', sort_order = 'desc' } = req.query;

    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    let docs = await SoftwareApp.find(query).lean();
    let records = docs.map(formatSoftwareAppDoc);

    // Case-insensitive search across name, category, type, platform, file_path, notes, client_name
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(item => {
        const fields = [
          item.name,
          item.category,
          item.type,
          item.platform,
          item.version,
          item.file_path,
          item.apk_path,
          item.client_name,
          item.contact_info,
          item.payment_status,
          item.status,
          item.notes,
          String(item.price || '')
        ].filter(Boolean);

        return fields.some(f => f.toLowerCase().includes(q));
      });
    }

    // Sort
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
      count: records.length
    });
  } catch (err) {
    console.error('Error fetching software & apps:', err);
    res.status(500).json({ error: 'Failed to retrieve software & app records.' });
  }
});

// GET /api/software/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await SoftwareApp.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    res.json(formatSoftwareAppDoc(doc));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve record.' });
  }
});

// POST /api/software
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category = 'Software',
      type = 'Software',
      platform = 'Android / Web',
      version = '1.0.0',
      file_path,
      apk_path,
      client_name = 'Mahesh Saini',
      contact_info,
      price = 0,
      payment_received = 0,
      payment_status = 'Paid',
      license_expiry,
      status = 'Active',
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Software / App name is required.' });
    }

    const numPrice = Math.max(0, parseFloat(price) || 0);
    const numReceived = Math.max(0, parseFloat(payment_received) || 0);
    const numPending = Math.max(0, numPrice - numReceived);

    const doc = await SoftwareApp.create({
      name: name.trim(),
      category: category || 'Software',
      type: type || 'Software',
      platform: platform ? platform.trim() : 'Android / Web',
      version: version ? version.trim() : '1.0.0',
      file_path: file_path ? file_path.trim() : null,
      apk_path: apk_path ? apk_path.trim() : null,
      client_name: client_name ? client_name.trim() : 'Mahesh Saini',
      contact_info: contact_info ? contact_info.trim() : null,
      price: numPrice,
      payment_received: numReceived,
      pending_amount: numPending,
      payment_status: payment_status || 'Paid',
      license_expiry: license_expiry || null,
      status: status || 'Active',
      notes: notes ? notes.trim() : null,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({
      message: 'Software / App record added successfully!',
      record: formatSoftwareAppDoc(doc)
    });
  } catch (err) {
    console.error('Error creating software/app record:', err);
    res.status(500).json({ error: 'Failed to create record.' });
  }
});

// PUT /api/software/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await SoftwareApp.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const {
      name,
      category,
      type,
      platform,
      version,
      file_path,
      apk_path,
      client_name,
      contact_info,
      price,
      payment_received,
      payment_status,
      license_expiry,
      status,
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Software / App name is required.' });
    }

    const numPrice = Math.max(0, parseFloat(price !== undefined ? price : existing.price) || 0);
    const numReceived = Math.max(0, parseFloat(payment_received !== undefined ? payment_received : existing.payment_received) || 0);
    const numPending = Math.max(0, numPrice - numReceived);

    existing.name = name.trim();
    if (category) existing.category = category;
    if (type) existing.type = type;
    if (platform) existing.platform = platform.trim();
    if (version) existing.version = version.trim();
    existing.file_path = file_path ? file_path.trim() : null;
    existing.apk_path = apk_path ? apk_path.trim() : null;
    if (client_name) existing.client_name = client_name.trim();
    existing.contact_info = contact_info ? contact_info.trim() : null;
    existing.price = numPrice;
    existing.payment_received = numReceived;
    existing.pending_amount = numPending;
    if (payment_status) existing.payment_status = payment_status;
    existing.license_expiry = license_expiry || null;
    if (status) existing.status = status;
    existing.notes = notes ? notes.trim() : null;
    existing.updated_at = new Date();

    await existing.save();

    res.json({
      message: 'Software / App record updated successfully!',
      record: formatSoftwareAppDoc(existing)
    });
  } catch (err) {
    console.error('Error updating software/app:', err);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

// DELETE /api/software/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await SoftwareApp.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    await SoftwareApp.findByIdAndDelete(req.params.id);
    res.json({ message: `Software / App "${existing.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting software/app:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

module.exports = router;
