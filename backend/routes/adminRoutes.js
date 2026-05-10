import { Router } from 'express';
import { body } from 'express-validator';
import { loginAdmin, listApplicants, getApplicantById, updateApplicantStatus } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  loginAdmin
);

router.use(requireAdminAuth);

router.get('/applicants', listApplicants);
router.get('/applicants/:id', getApplicantById);
router.patch(
  '/applicants/:id/status',
  [body('status').trim().isIn(['pending', 'reviewed', 'selected', 'rejected']).withMessage('Invalid status')],
  validateRequest,
  updateApplicantStatus
);

export default router;
