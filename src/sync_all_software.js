const { connectDb, SoftwareApp } = require('./mongo.js');

const softwareList = [
  {
    name: 'Hotel Management Suite & POS ERP',
    category: 'Hotel Management ERP',
    type: 'Full-Stack ERP & Android APKs',
    platform: 'Web / Linux / Android',
    version: 'v4.2.0 Enterprise',
    file_path: '/home/mahesh/Documents/Hotel-Software',
    apk_path: '/home/mahesh/Documents/Hotel-Software/apks/spicehub-staff.apk',
    client_name: 'Mahesh Hotel Hospitality / SpiceHub',
    contact_info: 'support@hotel-erp.local',
    price: 0,
    payment_received: 0,
    pending_amount: 0,
    payment_status: 'Free',
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
    price: 0,
    payment_received: 0,
    pending_amount: 0,
    payment_status: 'Free',
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
    price: 0,
    payment_received: 0,
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
    price: 0,
    payment_received: 0,
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
    price: 0,
    payment_received: 0,
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
    price: 0,
    payment_received: 0,
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
    price: 0,
    payment_received: 0,
    pending_amount: 0,
    payment_status: 'In-House',
    status: 'Active',
    notes: 'High-frequency algorithmic trading analysis, FTT validation, feature engineering, and predictive model training bot.'
  },
  {
    name: 'Zenuxs Native Design Editor (Figma Alternative)',
    category: 'Desktop Software',
    type: 'Tauri Rust & React Vector Suite',
    platform: 'Linux / Desktop / Web',
    version: 'v0.14.0',
    file_path: '/home/mahesh/zenuxs-desigen',
    apk_path: null,
    client_name: 'Zenuxs Team',
    price: 0,
    payment_received: 0,
    pending_amount: 0,
    payment_status: 'In-House',
    status: 'Active',
    notes: 'AI-native design editor and vector drawing tool. Open-source Figma alternative with infinite canvas and prototyping.'
  }
];

async function syncSoftware() {
  await connectDb();
  console.log('[MongoDB] Connected. Syncing software & APK records...');
  await SoftwareApp.deleteMany({});
  await SoftwareApp.insertMany(softwareList);
  const count = await SoftwareApp.countDocuments();
  console.log(`[MongoDB] Total software & APK records in Atlas: ${count}`);
  process.exit(0);
}

syncSoftware().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
