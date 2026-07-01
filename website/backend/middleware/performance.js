import compression from 'compression';

/** Target SLA for standard API routes (mobile + website). */
export const API_SLA_MS = Number(process.env.API_SLA_MS || 2_000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30_000);
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || API_SLA_MS);

/** Response compression, slow-request logging, and per-request timeouts. */
export function setupPerformanceMiddleware(app) {
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use((req, res, next) => {
    const started = process.hrtime.bigint();

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ message: 'Request timed out. Please try again.' });
      }
    }, REQUEST_TIMEOUT_MS);

    const finish = () => {
      clearTimeout(timer);
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (elapsedMs >= SLOW_REQUEST_MS) {
        console.warn(
          `[slow] ${req.method} ${req.originalUrl} ${elapsedMs.toFixed(0)}ms (sla=${SLOW_REQUEST_MS}ms)`,
        );
      }
    };

    res.on('finish', finish);
    res.on('close', finish);
    next();
  });
}
