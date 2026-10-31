import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { Prisma } from '../generated/prisma/index.js';
import config from '../config/index.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // 1. Handle known operational ApiErrors
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }
  // 2. Handle Zod schema validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
  }
  // 3. Handle Prisma Known Request Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        message = 'A record with this identifier already exists.';
        const target = err.meta?.target;
        details = target ? { field: Array.isArray(target) ? target.join(', ') : String(target) } : null;
        break;
      }
      case 'P2003': {
        statusCode = 400;
        message = 'Referenced parent record does not exist or relation is invalid.';
        break;
      }
      case 'P2000': {
        statusCode = 400;
        message = 'Submitted value exceeds permitted field limits or length.';
        break;
      }
      case 'P2025':
      case 'P2001':
      case 'P2015':
      case 'P2018': {
        statusCode = 404;
        message = 'The requested record was not found.';
        break;
      }
      case 'P2024': {
        statusCode = 503;
        message = 'Database connection timed out. Please retry shortly.';
        break;
      }
      default: {
        // Unknown or unhandled P-codes default strictly to 500
        statusCode = 500;
        message = 'Database operation failed.';
        if (!config.isProduction) {
          details = { code: err.code };
        }
        break;
      }
    }
  }
  // 4. Handle Prisma Schema Validation Errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid query or payload structure provided.';
  }
  // 5. Handle Prisma Connection / Initialization Failures
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = 'Database service is temporarily unavailable.';
  }
  // 6. Handle Prisma Engine Panics and Unknown Database Errors
  else if (
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    statusCode = 500;
    message = 'An unexpected database error occurred.';
  }
  // 7. Handle JSON parse syntax errors in body
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
  }
  // 8. General unhandled exceptions
  else {
    statusCode = err.status || err.statusCode || 500;
    message = config.isProduction ? 'An unexpected error occurred' : (err.message || message);
  }

  const responsePayload = {
    success: false,
    message,
    ...(details !== null ? { details } : {}),
    ...(!config.isProduction && err.stack ? { stack: err.stack } : {})
  };

  res.status(statusCode).json(responsePayload);
};

export default errorHandler;
