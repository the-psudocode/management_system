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
  // Handle SQLite constraint and database errors
  else if (err.name === 'SqliteError') {
    statusCode = 400;
    message = `Database Error: ${err.message}`;
    details = {
      code: err.code
    };
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

