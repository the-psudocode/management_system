import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import config from '../config/index.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle known operational ApiErrors
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }
  // Handle Zod schema validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
  }
  // Handle PostgreSQL constraint and database errors
  else if (err.code && typeof err.code === 'string' && (err.code.length === 5 || err.routine)) {
    switch (err.code) {
      case '23505': // unique_violation
        statusCode = 409;
        message = 'A record with this information already exists (unique constraint violation)';
        details = { detail: err.detail, constraint: err.constraint };
        break;
      case '23503': // foreign_key_violation
        statusCode = 400;
        message = 'Referenced record does not exist (foreign key constraint violation)';
        details = { detail: err.detail, constraint: err.constraint };
        break;
      case '23514': // check_violation
        statusCode = 400;
        message = 'Input violates database check constraint';
        details = { detail: err.detail, constraint: err.constraint };
        break;
      case '23502': // not_null_violation
        statusCode = 400;
        message = `Missing required field: ${err.column}`;
        details = { column: err.column };
        break;
      case '08001': // unable_to_connect
      case '08006': // connection_failure
      case '57P01': // admin_shutdown
        statusCode = 503;
        message = 'Database connection failure. Please try again shortly.';
        break;
      default:
        statusCode = 400;
        message = config.isProduction ? 'Database operation failed' : `Database Error: ${err.message}`;
        details = { code: err.code, detail: err.detail, constraint: err.constraint };
        break;
    }
  }
  // Handle JSON parse syntax errors in body
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
  }
  // General unhandled exceptions
  else {
    statusCode = err.status || err.statusCode || 500;
    message = config.isProduction ? 'An unexpected error occurred' : (err.message || message);
  }

  const responsePayload = {
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(!config.isProduction && err.stack ? { stack: err.stack } : {})
  };

  res.status(statusCode).json(responsePayload);
};

export default errorHandler;

