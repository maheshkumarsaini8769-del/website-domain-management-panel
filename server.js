const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectDb } = require('./src/mongo');
const { router: authRouter } = require('./src/auth');
const websitesRouter = require('./src/websites');
const softwareRouter = require('./src/software');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB Atlas
connectDb();

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use(['/api/auth', '/auth'], authRouter);
app.use(['/api/websites', '/websites'], websitesRouter);
app.use(['/api/software', '/software'], softwareRouter);

// Fallback to index.html for any SPA web page requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` Website, Domain, & Software Management Panel RUNNING!`);
    console.log(` Database:    MongoDB Atlas (cluster0.ajeqt1u.mongodb.net)`);
    console.log(` Local URL:   http://localhost:${PORT}`);
    console.log(` Network URL: http://127.0.0.1:${PORT}`);
    console.log(` Admin User:  maheshsaini`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = Number(PORT) + 1;
      console.warn(`Port ${PORT} is busy, retrying on port ${fallbackPort}...`);
      app.listen(fallbackPort, '0.0.0.0', () => {
        console.log(`Panel is running on http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = app;
