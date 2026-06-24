import dotenv from 'dotenv';

// Load environment variables before importing other modules
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at startup:', reason);
});

const startServer = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB on startup:', err && err.message ? err.message : err);
    // Exit so a process manager (or nodemon) can restart after transient failures
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
