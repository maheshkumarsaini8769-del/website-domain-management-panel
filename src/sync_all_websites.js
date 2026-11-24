const { connectDb, Website, getDashboardStats } = require('./mongo.js');
const websitesToStore = require('./seed_websites.js');

async function syncAll() {
  await connectDb();
  console.log('[MongoDB] Connected. Clearing old website collection to ensure exact sync...');
  await Website.deleteMany({});
  
  console.log(`[MongoDB] Inserting ${websitesToStore.length} websites into MongoDB Atlas...`);
  await Website.insertMany(websitesToStore);

  const stats = await getDashboardStats();
  console.log('[MongoDB] Updated Dashboard Stats:', JSON.stringify(stats, null, 2));

  const count = await Website.countDocuments();
  console.log(`[MongoDB] Total website records in Atlas: ${count}`);

  process.exit(0);
}

syncAll().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
