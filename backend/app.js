import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import dotenv from 'dotenv';
import applicationRoutes from './routes/applicationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import sanitizeRequest from './middleware/sanitizeRequest.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Debug: show whether BREVO_API_KEY is available at app startup (masked)
try {
  const raw = process.env.BREVO_API_KEY;
  const key = raw ? String(raw).replace(/^['"]|['"]$/g, '') : undefined;
  const masked = key ? `${key.slice(0, 8)}...` : 'none';
  console.log(`BREVO_API_KEY at app startup (masked): ${masked}`);
} catch (e) {
  // ignore
}

const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

const isLocalDevOrigin = (origin) => {
  if (!origin) {
    return false;
  }

  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    );
  } catch {
    return false;
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/admin/login' || req.path === '/users/login',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(mongoSanitize());
app.use(sanitizeRequest);
app.use(hpp());
app.use('/api/admin/login', loginLimiter);
app.use('/api/users/login', loginLimiter);
app.use('/api', apiLimiter);

app.use('/', healthRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
