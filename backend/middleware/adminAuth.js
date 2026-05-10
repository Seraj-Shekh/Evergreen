import { verifyAdminToken } from '../services/adminToken.js';

export const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || req.headers['x-admin-token'];

  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  req.admin = payload;
  return next();
};
