import { sendErrorResponse } from '../utils/errorFeedback.js';

/** Express global error handler — last middleware on the app. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err?.status || err?.statusCode || 500;
  return sendErrorResponse(res, err, status);
}

/** Wrap async route handlers so rejections reach [errorHandler]. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
