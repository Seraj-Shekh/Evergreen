import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginUser, getCurrentUser, changePassword, updatePhoneNumber } from '../controllers/userController.js';
import { requireUserAuth } from '../middleware/userAuth.js';

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  loginUser
);

router.use(requireUserAuth);

router.get('/me', getCurrentUser);

router.patch(
  '/profile',
  [body('phoneNumber').trim().notEmpty().withMessage('Phone number is required')],
  validateRequest,
  updatePhoneNumber
);

router.post(
  '/change-password',
  [
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validateRequest,
  changePassword
);

export default router;
