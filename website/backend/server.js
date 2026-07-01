import http from 'http';
import dotenv from 'dotenv';
import { buildApp, resolveCorsOrigin } from './app.js';
import { ensureTherapistContentBucket } from './controllers/resourceController.js';
import { initSocketServer } from './realtime/socketServer.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { startAppointmentReminderScheduler } from './services/appointmentReminderService.js';
import { getRedisClient, isRedisConfigured } from './config/redis.js';
import { validateProductionHttpsEnv } from './utils/httpsPolicy.js';

dotenv.config();

if (!process.env.NODE_ENV) {
  console.warn(
    '⚠️  NODE_ENV is not set. Defaulting to development behavior; set NODE_ENV=production in deploy.',
  );
}

if (process.env.NODE_ENV === 'production') {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL) {
    console.error('FATAL: SUPABASE_URL is missing in production. Exiting.');
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      'FATAL: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) is missing in production. Exiting.',
    );
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      'FATAL: JWT_SECRET is missing or too short in production. Exiting.',
    );
    process.exit(1);
  }

  const httpsErrors = validateProductionHttpsEnv();
  if (httpsErrors.length) {
    for (const message of httpsErrors) {
      console.error(`FATAL: ${message}`);
    }
    process.exit(1);
  }
}

initFirebaseAdmin();

if (isRedisConfigured()) {
  getRedisClient()
    ?.connect()
    .catch((err) => console.error('[redis] connect failed:', err?.message || err));
}

const ZOOM_REQUIRED = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
const ZOOM_MISSING = ZOOM_REQUIRED.filter((k) => !process.env[k]);
if (ZOOM_MISSING.length) {
  console.warn(
    `⚠️  Zoom env vars missing: ${ZOOM_MISSING.join(', ')}. ` +
      'Zoom meeting creation will be disabled until these are set.',
  );
}

ensureTherapistContentBucket().catch((e) =>
  console.error('ensureTherapistContentBucket:', e),
);

const app = buildApp();
const httpServer = http.createServer(app);
initSocketServer(httpServer, { corsOriginResolver: resolveCorsOrigin });

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `FATAL: Port ${PORT} is already in use. Stop the other Node process or set PORT to a free port.`,
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, HOST, () => {
  console.log(`✅ Server + Socket.io running on http://${HOST}:${PORT}`);
  startAppointmentReminderScheduler();
});
