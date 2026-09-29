'use strict';
class HttpError extends Error {
  constructor(status, code, message, hint) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}
const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error('[error]', err.message);
  res.status(status).json({
    error: { code: err.code || 'internal_error', message: err.message || 'Unexpected error', hint: err.hint },
  });
};
module.exports = { HttpError, notFound, errorHandler };
