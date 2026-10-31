export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const payload = {
    success: true,
    message
  };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

export const sendError = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
  const payload = {
    success: false,
    message
  };

  if (details !== null) {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
};

export default {
  sendSuccess,
  sendError
};

