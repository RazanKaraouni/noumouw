import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import therapistRoutes from './routes/therapistRoutes.js';
import therapistAccountRoutes from './routes/therapistAccountRoutes.js';
import { listTherapistsDirectory } from './controllers/therapistController.js';
import { listNearbyProviders } from './controllers/nearbyProvidersController.js';
import milestoneRoutes from './routes/milestoneRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import userRoutes from './routes/userRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import adminResourceRoutes from './routes/adminResourceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import therapistAvailabilityRoutes from './routes/therapistAvailabilityRoutes.js';
import therapistAppointmentsRoutes from './routes/therapistAppointmentsRoutes.js';
import therapistPaymentsRoutes from './routes/therapistPaymentsRoutes.js';
import therapistChildrenRoutes from './routes/therapistChildrenRoutes.js';
import therapistAssignmentsApiRoutes from './routes/therapistAssignmentsApiRoutes.js';
import therapistPrivateNotesApiRoutes from './routes/therapistPrivateNotesApiRoutes.js';
import signupRoutes from './routes/signupRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminModerationRoutes from './routes/adminModeration.js';
import adminOverviewRoutes from './routes/overviewRoutes.js';
import autismRoutes from './routes/autismRoutes.js';
import masterActivityRoutes from './routes/masterActivityRoutes.js';
import childrenRoutes from './routes/childrenRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import parentAssignmentsRoutes from './routes/parentAssignmentsRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import deviceTokensRoutes from './routes/deviceTokensRoutes.js';
import saveTokenRoutes from './routes/saveTokenRoutes.js';
import pushNotificationRoutes from './routes/pushNotificationRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import adminCommunityRoutes from './routes/adminCommunityRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import adminLogsRoutes from './routes/adminLogsRoutes.js';
import parentingTipsRoutes from './routes/parentingTips.js';
import parentActivitySuggestionRoutes from './routes/parentActivitySuggestionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupPerformanceMiddleware } from './middleware/performance.js';
import { authenticate, requireRole } from './middleware/auth.js';
import {
  authRouterRateLimiter,
  globalApiRateLimiter,
} from './middleware/rateLimit.js';
import helmet from 'helmet';
import { isHttpsUrl } from './utils/httpsPolicy.js';

const isProduction = process.env.NODE_ENV === 'production';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}

const devDefaultOrigins = ['http://localhost:5173'];

function resolveCorsOrigin(origin, callback) {
  const corsOriginsFromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!origin) return callback(null, true);

  const allowList = isProduction
    ? [...new Set(corsOriginsFromEnv)]
    : [...new Set([...corsOriginsFromEnv, ...devDefaultOrigins])];

  if (allowList.includes(origin)) return callback(null, true);

  if (!isProduction) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }

  if (isHttpsUrl(origin)) return callback(null, true);
  return callback(null, false);
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
function healthHandler(_req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

/** Build the Express app without binding a port (used by server.js and tests). */
export function buildApp() {
  const app = express();

  if (isProduction) {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
      const forwardedProto = req.get('x-forwarded-proto');
      if (forwardedProto && forwardedProto !== 'https') {
        const host = req.get('host');
        if (host) {
          return res.redirect(301, `https://${host}${req.originalUrl}`);
        }
      }
      next();
    });
  }

  // TODO: tighten CSP once all CDN/asset domains (fonts, Supabase, etc.) are catalogued.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
        },
      },
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  app.use(
    cors({
      origin: resolveCorsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));
  setupPerformanceMiddleware(app);

  // PUBLIC: intentional because load balancers and uptime monitors need an unauthenticated probe.
  app.get('/health', healthHandler);

  app.use('/api', globalApiRateLimiter);

  app.get(
    '/api/therapists-directory',
    authenticate,
    requireRole('parent', 'admin'),
    listTherapistsDirectory,
  );
  // PUBLIC: intentional because parents browse nearby providers before signing in (no PII in response).
  app.get('/api/nearby-providers', listNearbyProviders);

  app.use('/api/auth', authRouterRateLimiter, authRoutes);
  app.use('/api/users', userRoutes);

  app.use('/api/therapists/account', therapistAccountRoutes);
  app.use('/api/therapists', therapistRoutes);
  app.use('/api/therapists/children', therapistChildrenRoutes);
  app.use('/api/therapists/assignments', therapistAssignmentsApiRoutes);
  app.use('/api/therapists/private-notes', therapistPrivateNotesApiRoutes);
  app.use('/api/therapists/availability', therapistAvailabilityRoutes);
  app.use('/api/therapists/appointments', therapistAppointmentsRoutes);
  app.use('/api/therapists/payments', therapistPaymentsRoutes);

  app.use('/api', signupRoutes);
  app.use('/api', adminModerationRoutes);
  app.use('/api/admin', adminOverviewRoutes);

  app.use('/api/milestones', milestoneRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/admin/resources', adminResourceRoutes);
  app.use('/api/admin/community', adminCommunityRoutes);
  app.use('/api/admin/announcements', announcementRoutes);
  app.use('/api/admin/logs', adminLogsRoutes);
  app.use('/api/master-activities', masterActivityRoutes);

  app.use('/api/booking', bookingRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/autism', autismRoutes);
  app.use('/api/children', childrenRoutes);

  app.use('/api/chat', chatRoutes);
  app.use('/api/assignments', parentAssignmentsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/device-tokens', deviceTokensRoutes);
  app.use('/api', saveTokenRoutes);
  app.use('/api', pushNotificationRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api/tips', parentingTipsRoutes);
  app.use('/api/parent/activities', parentActivitySuggestionRoutes);

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(errorHandler);

  return app;
}

export { resolveCorsOrigin };
