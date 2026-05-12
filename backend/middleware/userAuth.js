import { verifyUserToken } from '../services/userToken.js';

export const requireUserAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || req.headers['x-user-token'];

  const payload = verifyUserToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  req.user = payload;
  return next();
};
