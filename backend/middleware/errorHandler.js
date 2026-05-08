export const errorHandler = (error, _req, res, _next) => {
  // Mongoose duplicate key error
  if (error && error.name === 'MongoServerError' && error.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate value error' });
  }

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Server error',
  });
};
