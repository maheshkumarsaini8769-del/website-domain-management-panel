const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://maheshkumarsaini8769_db_user:vtrY4fVb8DjywR4I@cluster0.ajeqt1u.mongodb.net/website_domain_panel?retryWrites=true&w=majority';

// --- Schema Definitions ---

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true },
  password_hash: { type: String, required: true },
  is_default_password: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const WebsiteSchema = new mongoose.Schema({
  website_name: { type: String, required: true, trim: true },
  website_url: { type: String, required: true, trim: true },
  client_name: { type: String, required: true, trim: true },
  contact_info: { type: String, default: null },
  website_built_date: { type: String, default: null },
  domain_purchase_date: { type: String, default: null },
  domain_registrar: { type: String, default: null },
  domain_duration_years: { type: Number, default: 1 },
  domain_expiry_date: { type: String, default: null },
  total_price: { type: Number, default: 0 },
  payment_received: { type: Number, default: 0 },
  pending_amount: { type: Number, default: 0 },
  payment_date: { type: String, default: null },
  payment_notes: { type: String, default: null },
  sale_status: { type: String, default: 'Not for Sale' },
  selling_price: { type: Number, default: null },
  sold_date: { type: String, default: null },
  admin_access_given: { type: Boolean, default: false },
  admin_name: { type: String, default: null },
  admin_given_date: { type: String, default: null },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const SoftwareAppSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'Software' }, // Hotel Management ERP, Mobile Android APK, Utility Software, Desktop Software
  type: { type: String, default: 'Software' },     // Web ERP, Android APK, Desktop App
  platform: { type: String, default: 'Android / Web' },
  version: { type: String, default: '1.0.0' },
  file_path: { type: String, default: null },
  apk_path: { type: String, default: null },
  client_name: { type: String, default: 'Mahesh Saini' },
  contact_info: { type: String, default: null },
  price: { type: Number, default: 0 },
  payment_received: { type: Number, default: 0 },
  pending_amount: { type: Number, default: 0 },
  payment_status: { type: String, default: 'Paid' },
  license_expiry: { type: String, default: null },
  status: { type: String, default: 'Active' },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Website = mongoose.model('Website', WebsiteSchema);
const SoftwareApp = mongoose.model('SoftwareApp', SoftwareAppSchema);

// Calculation Helpers
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

function calculateExpiryDate(purchaseDateStr, durationYears) {
  if (!purchaseDateStr) return '';
  const parts = purchaseDateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const duration = parseInt(durationYears, 10) || 1;
  const targetYear = y + duration;
  const date = new Date(Date.UTC(targetYear, m - 1, d));
  return date.toISOString().split('T')[0];
}

function normalizeUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

function formatWebsiteDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const expiryInfo = computeExpiry(obj.domain_expiry_date);
  const totalPrice = Number(obj.total_price) || 0;
  const paymentReceived = Number(obj.payment_received) || 0;
  const pendingAmount = Math.max(0, totalPrice - paymentReceived);

  return {
    ...obj,
    id: obj._id ? obj._id.toString() : obj.id,
    total_price: totalPrice,
    payment_received: paymentReceived,
    pending_amount: pendingAmount,
    selling_price: obj.selling_price !== null && obj.selling_price !== undefined ? Number(obj.selling_price) : null,
    admin_access_given: Boolean(obj.admin_access_given),
    days_remaining: expiryInfo.days_remaining,
    expiry_status: expiryInfo.expiry_status
  };
}

function formatSoftwareAppDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const price = Number(obj.price) || 0;
  const paymentReceived = Number(obj.payment_received) || 0;
  const pending = Math.max(0, price - paymentReceived);

  return {
    ...obj,
    id: obj._id ? obj._id.toString() : obj.id,
    price,
    payment_received: paymentReceived,
    pending_amount: pending
  };
}

async function getDashboardStats() {
  const allDocs = await Website.find({}).lean();
  const allRows = allDocs.map(formatWebsiteDoc);

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

  // Also include software apps count
  const softwareAppsCount = await SoftwareApp.countDocuments();

  return {
    total_websites,
    total_for_sale,
    total_sold,
    total_payment_received,
    total_pending_payment,
    total_cleared_payment: total_payment_received,
    total_expiring_30_days,
    total_expired,
    total_active,
    total_admin_access_given,
    total_admin_access_not_given,
    total_software_apps: softwareAppsCount
  };
}

// Connect & Seed Database
async function connectDb() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[MongoDB] Connected to MongoDB Atlas cluster0 successfully!');

    // Initialize default admin user if not present
    const existingAdmin = await User.findOne({ username: 'maheshsaini' });
    if (!existingAdmin) {
      const defaultHash = bcrypt.hashSync('mahesh99830', 10);
      await User.create({
        username: 'maheshsaini',
        password_hash: defaultHash,
        is_default_password: true
      });
      console.log('[MongoDB] Initialized default admin user: maheshsaini');
    }

    // Seed website records if empty
    const websiteCount = await Website.countDocuments();
    if (websiteCount === 0) {
      console.log('[MongoDB] Seeding user websites & domains from laptop projects...');
      await Website.create([
        {
          website_name: 'Sikar Water Distributor',
          website_url: 'https://sikarwaterdistributor.com',
          client_name: 'Sikar Drop / Mahesh Saini',
          contact_info: '+91 9876543210',
          website_built_date: '2024-03-10',
          domain_purchase_date: '2024-03-10',
          domain_registrar: 'Hostinger',
          domain_duration_years: 2,
          domain_expiry_date: '2026-03-10',
          total_price: 35000,
          payment_received: 35000,
          pending_amount: 0,
          payment_date: '2024-03-12',
          payment_notes: 'UPI Paid in full',
          sale_status: 'Not for Sale',
          admin_access_given: true,
          admin_name: 'Mahesh Saini (Admin)',
          admin_given_date: '2024-03-15',
          notes: 'Source folder: /home/mahesh/sikar drop\nGit repo: https://github.com/maheshkumarsaini8769-del/sikar-drop.git\nOnline water can delivery and monthly subscription management portal for Sikar region.'
        },
        {
          website_name: 'Shree Shyam Interiors',
          website_url: 'https://shreeshyaminteriors.com',
          client_name: 'Shree Shyam Interiors',
          contact_info: 'contact@shreeshyaminteriors.com',
          website_built_date: '2024-04-15',
          domain_purchase_date: '2024-04-15',
          domain_registrar: 'GoDaddy',
          domain_duration_years: 1,
          domain_expiry_date: '2025-04-15',
          total_price: 45000,
          payment_received: 45000,
          pending_amount: 0,
          payment_date: '2024-04-20',
          payment_notes: 'Bank Transfer (NEFT)',
          sale_status: 'Not for Sale',
          admin_access_given: true,
          admin_name: 'Shree Shyam Team (WordPress Admin)',
          admin_given_date: '2024-04-22',
          notes: 'Source folder: /home/mahesh/shree-shyam-interior & shree-shyam-pvc\nGit repo: https://github.com/maheshkumarsaini8769-del/shree-shyam-interior\nPVC wall panels, false ceiling, and interior decor catalogue site.'
        },
        {
          website_name: 'Star Home Interior',
          website_url: 'https://starhomeinterior.in',
          client_name: 'Star Home Interior / Sikar Supply',
          contact_info: '+91 9988776655',
          website_built_date: '2024-05-20',
          domain_purchase_date: '2024-05-20',
          domain_registrar: 'BigRock',
          domain_duration_years: 1,
          domain_expiry_date: '2025-05-20',
          total_price: 40000,
          payment_received: 25000,
          pending_amount: 15000,
          payment_date: '2024-05-25',
          payment_notes: 'Advance Received via GPay',
          sale_status: 'For Sale',
          selling_price: 60000,
          admin_access_given: false,
          admin_name: null,
          admin_given_date: null,
          notes: 'Source folder: /home/mahesh/star home inertior (sikar-supply)\nModular kitchen, modern interior decoration and woodwork portal. Currently listed for sale.'
        },
        {
          website_name: 'Sun Sky Tourisms',
          website_url: 'https://sunskytourisms.in',
          client_name: 'Sun Sky Tourisms & Travels',
          contact_info: 'info@sunskytourisms.in',
          website_built_date: '2024-02-01',
          domain_purchase_date: '2024-02-01',
          domain_registrar: 'Namecheap',
          domain_duration_years: 1,
          domain_expiry_date: '2025-02-01',
          total_price: 50000,
          payment_received: 50000,
          pending_amount: 0,
          payment_date: '2024-02-05',
          payment_notes: 'Paid via NetBanking',
          sale_status: 'Not for Sale',
          admin_access_given: true,
          admin_name: 'Sun Sky Travels Operations',
          admin_given_date: '2024-02-10',
          notes: 'Source folder: /home/mahesh/tour new & tour tour\nGit repo: https://github.com/maheshkumarsaini8769-del/travel-the-world.git\nTour packages, holiday bookings, Rajasthan tourism and cab rental booking platform.'
        },
        {
          website_name: 'Rajesh Water Supply',
          website_url: 'https://rajeshwater.com',
          client_name: 'Rajesh Water Services',
          contact_info: '+91 9414000000',
          website_built_date: '2024-06-01',
          domain_purchase_date: '2024-06-01',
          domain_registrar: 'Hostinger',
          domain_duration_years: 1,
          domain_expiry_date: '2025-06-01',
          total_price: 25000,
          payment_received: 20000,
          pending_amount: 5000,
          payment_date: '2024-06-05',
          payment_notes: 'Part payment received',
          sale_status: 'Not for Sale',
          admin_access_given: false,
          admin_name: null,
          admin_given_date: null,
          notes: 'Source folder: /home/mahesh/rajesh-water-site & rajesh-water\nGit repo: https://github.com/maheshkumarsaini8769-del/rajesh-water-site\nWater supply, bulk delivery orders, and customer dispatch.'
        },
        {
          website_name: 'Thar Swad Desi Aachar',
          website_url: 'https://tharswad.com',
          client_name: 'Thar Swad Organic Pickles',
          contact_info: 'orders@tharswad.com',
          website_built_date: '2024-07-10',
          domain_purchase_date: '2024-07-10',
          domain_registrar: 'Cloudflare',
          domain_duration_years: 1,
          domain_expiry_date: '2025-07-10',
          total_price: 35000,
          payment_received: 35000,
          pending_amount: 0,
          payment_date: '2024-07-15',
          payment_notes: 'Razorpay / UPI Full Payment',
          sale_status: 'Not for Sale',
          admin_access_given: true,
          admin_name: 'Store Manager',
          admin_given_date: '2024-07-18',
          notes: 'Source folder: /home/mahesh/aachar\nGit repo: https://github.com/maheshkumarsaini8769-del/aachar.git\nAuthentic traditional Rajasthani homemade pickles and spice products e-commerce store.'
        }
      ]);
      console.log('[MongoDB] Seeded 6 websites successfully!');
    }

    // Seed software & apps records if empty
    const softwareCount = await SoftwareApp.countDocuments();
    if (softwareCount === 0) {
      console.log('[MongoDB] Seeding hotel software & mobile APKs...');
      await SoftwareApp.create([
        {
          name: 'SpiceHub Hotel Management ERP & Staff Suite',
          category: 'Hotel Management ERP',
          type: 'Web ERP & Mobile Apps',
          platform: 'Android / Web / Desktop',
          version: 'v2.5.0 Production',
          file_path: '/home/mahesh/Documents/Hotel-Software',
          apk_path: '/home/mahesh/Documents/Hotel-Software/apks/spicehub-staff.apk',
          client_name: 'Mahesh Hotel Hospitality / SpiceHub',
          contact_info: 'support@hotel-erp.local',
          price: 150000,
          payment_received: 150000,
          pending_amount: 0,
          payment_status: 'Paid',
          status: 'Active',
          notes: 'Comprehensive Hotel Management Suite includes:\n• Reception Frontdesk & Guest PMS\n• Dining Table QR Code Ordering (Customer App)\n• Kitchen Order Display (KDS)\n• Staff Waiter & Housekeeping Android APKs\n• Night Audit & Financial Reports\n• APKs: SpiceHub-Production-Live.apk, spicehub-staff.apk, spicehub-customer.apk'
        },
        {
          name: 'SpiceHub Guest Dining & Room Service APK',
          category: 'Mobile Android APK',
          type: 'Android APK',
          platform: 'Android',
          version: 'v2.5.2 Final',
          file_path: '/home/mahesh/Documents/Hotel-Software',
          apk_path: '/home/mahesh/Documents/Hotel-Software/SpiceHub-Customer-Final.apk',
          client_name: 'Mahesh Hotel Guests',
          price: 45000,
          payment_received: 45000,
          pending_amount: 0,
          payment_status: 'Paid',
          status: 'Active',
          notes: 'Guest-facing Android APK for contactless table ordering, room service food delivery, and digital bill request.'
        },
        {
          name: 'MovieBox Streaming App',
          category: 'Mobile Android APK',
          type: 'Android APK',
          platform: 'Android',
          version: 'v1.4.0',
          file_path: '/home/mahesh/Desktop',
          apk_path: '/home/mahesh/Desktop/base.apk',
          client_name: 'Mahesh Saini (Personal)',
          price: 20000,
          payment_received: 20000,
          pending_amount: 0,
          payment_status: 'In-House',
          status: 'Active',
          notes: 'Android application for movie & video streaming. Desktop shortcut available on /home/mahesh/Desktop/MovieBox.desktop. APK at /home/mahesh/Desktop/base.apk.'
        },
        {
          name: 'Mobile Remote Keypad & Touchpad Controller',
          category: 'Mobile Android APK',
          type: 'Android APK & Desktop Server',
          platform: 'Android / Linux Desktop',
          version: 'v1.0.2',
          file_path: '/home/mahesh/.gemini/antigravity/scratch/mobile_remote_pad',
          apk_path: '/home/mahesh/.gemini/antigravity/scratch/mobile_remote_pad/android/build/RemotePad.apk',
          client_name: 'Mahesh Saini (Personal)',
          price: 15000,
          payment_received: 15000,
          pending_amount: 0,
          payment_status: 'In-House',
          status: 'Active',
          notes: 'Turns Android smartphone into a remote keypad, trackpad, and media control for Linux desktop. Desktop launcher on Desktop.'
        },
        {
          name: 'Audio Effects & Bass Tuner',
          category: 'Mobile Android APK',
          type: 'Android APK & Linux Audio Daemon',
          platform: 'Android / Linux Desktop',
          version: 'v1.2.0',
          file_path: '/home/mahesh/laptop-audio-effects',
          apk_path: '/home/mahesh/.gemini/antigravity/scratch/AudioTunerApp/app/build/outputs/apk/debug/app-debug.apk',
          client_name: 'Mahesh Saini (Personal)',
          price: 18000,
          payment_received: 18000,
          pending_amount: 0,
          payment_status: 'In-House',
          status: 'Active',
          notes: 'System-wide bass booster, acoustic equalizer, and audio enhancer with Android companion app.'
        },
        {
          name: 'ZXAsus TUF Monitor & Dell Fan Controller',
          category: 'Desktop Software',
          type: 'Desktop Python GUI & Daemon',
          platform: 'Linux Desktop (ASUS / Dell)',
          version: 'v2.1.0',
          file_path: '/home/mahesh/zxasus-panel',
          apk_path: null,
          client_name: 'Mahesh Saini',
          price: 25000,
          payment_received: 25000,
          pending_amount: 0,
          payment_status: 'In-House',
          status: 'Active',
          notes: 'Hardware performance monitor and automated fan curve controller for ASUS TUF and Dell BIOS fan control. Git repo: https://github.com/developer-rs5/zxasus-panel'
        },
        {
          name: 'Mahesh TT Algorithmic Trading Bot',
          category: 'Desktop Software',
          type: 'Python Data Science / ML Bot',
          platform: 'Linux / Python 3.14',
          version: 'v3.0.0',
          file_path: '/home/mahesh/Desktop/mahesh tt',
          apk_path: null,
          client_name: 'Mahesh Saini',
          price: 75000,
          payment_received: 75000,
          pending_amount: 0,
          payment_status: 'In-House',
          status: 'Active',
          notes: 'High-frequency algorithmic trading analysis, FTT validation, feature engineering, and predictive model training bot.'
        }
      ]);
      console.log('[MongoDB] Seeded 7 software & app records successfully!');
    }

  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
  }
}

module.exports = {
  mongoose,
  User,
  Website,
  SoftwareApp,
  connectDb,
  computeExpiry,
  calculateExpiryDate,
  normalizeUrl,
  formatWebsiteDoc,
  formatSoftwareAppDoc,
  getDashboardStats
};
