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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize());
app.use(sanitizeRequest);
app.use(hpp());
app.use('/api', apiLimiter);

app.use('/', healthRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
