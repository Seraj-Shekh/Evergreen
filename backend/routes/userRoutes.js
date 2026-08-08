import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginUser, getCurrentUser, changePassword, updatePhoneNumber, updateBankDetails, getGroupMembers, getIncomeHistory, getExpenseHistory, getPaymentHistory, getFineHistory, downloadFineAttachment, requestPasswordReset, resetPassword } from '../controllers/userController.js';
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

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  validateRequest,
  requestPasswordReset
);

router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validateRequest,
  resetPassword
);

router.use(requireUserAuth);

router.get('/me', getCurrentUser);

router.patch(
  '/profile',
  [body('phoneNumber').trim().notEmpty().withMessage('Phone number is required')],
  validateRequest,
  updatePhoneNumber
);

router.patch(
  '/bank-details',
  [
    body('bankName').trim().notEmpty().withMessage('Bank name is required'),
    body('bankAccountNumber').trim().notEmpty().withMessage('Bank account number is required'),
  ],
  validateRequest,
  updateBankDetails
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

router.get('/group-members', getGroupMembers);

router.get('/income', getIncomeHistory);

router.get('/expenses', getExpenseHistory);

router.get('/payments', getPaymentHistory);

router.get('/fines', getFineHistory);

router.get('/fines/:id/attachment', downloadFineAttachment);

export default router;
