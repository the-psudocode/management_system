const jsonSafe = (value) => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]));
  }
  return value;
};

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const payload = {
    success: true,
    message
  };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(jsonSafe(payload));
};

export const sendError = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
  const payload = {
    success: false,
    message
  };

  if (details !== null) {
    payload.details = details;
  }

  return res.status(statusCode).json(jsonSafe(payload));
};

export default {
  sendSuccess,
  sendError
};

