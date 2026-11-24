const app = require('../server.js');
const { connectDb } = require('../src/mongo.js');

module.exports = async (req, res) => {
  await connectDb();
  return app(req, res);
};
