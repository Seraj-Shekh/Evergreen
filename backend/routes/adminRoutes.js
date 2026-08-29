import { Router } from 'express';
import { body } from 'express-validator';
import { loginAdmin, listApplicants, getApplicantById, updateApplicantStatus, createUserAccounts, removeUserAccounts, addIncomeRecord, addIncomeRecordsBulk, deleteIncomeRecord, listIncomeRecords, getTopPickers, listExpensePlans, saveExpensePlan, deleteExpensePlan, getPaymentPreview, listPaymentRecords, createPayment, getOutstandingPayments, listFineRecords, createFineRecords, updateFineRecord, deleteFineRecord, downloadFineAttachment } from '../controllers/adminController.js';
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

router.post(
  '/users/create',
  [
    body('applicantIds').isArray({ min: 1 }).withMessage('applicantIds must be a non-empty array'),
    body('groupAssignments').isObject().withMessage('groupAssignments must be an object'),
  ],
  validateRequest,
  createUserAccounts
);

router.post(
  '/users/remove',
  [
    body('applicantIds').isArray({ min: 1 }).withMessage('applicantIds must be a non-empty array'),
  ],
  validateRequest,
  removeUserAccounts
);

router.post(
  '/income',
  [
    body('applicantId').trim().notEmpty().withMessage('applicantId is required'),
    body('date').trim().notEmpty().withMessage('date is required'),
    body('location').trim().notEmpty().withMessage('location is required'),
    body('berryType').trim().notEmpty().withMessage('berryType is required'),
    body('berryWeightKg').isFloat({ min: 0 }).withMessage('berryWeightKg must be a non-negative number'),
    body('carrotWeightKg').isFloat({ min: 0 }).withMessage('carrotWeightKg must be a non-negative number'),
    body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
  ],
  validateRequest,
  addIncomeRecord
);

router.post(
  '/income/bulk',
  [
    body('applicantId').trim().notEmpty().withMessage('applicantId is required'),
    body('records').isArray({ min: 1 }).withMessage('records must be a non-empty array'),
  ],
  validateRequest,
  addIncomeRecordsBulk
);

router.get('/income', listIncomeRecords);
router.get('/top-pickers', getTopPickers);
router.delete('/income/:id', deleteIncomeRecord);

router.get('/payments/preview', getPaymentPreview);
router.get('/payments/outstanding', getOutstandingPayments);
router.get('/payments', listPaymentRecords);
router.post(
  '/payments',
  [
    body('applicantId').trim().notEmpty().withMessage('applicantId is required'),
  ],
  validateRequest,
  createPayment
);

router.get('/fines', listFineRecords);
router.post(
  '/fines',
  [
    body('applicantIds').isArray({ min: 1 }).withMessage('applicantIds must be a non-empty array'),
    body('date').trim().notEmpty().withMessage('date is required'),
    body('reason').trim().notEmpty().withMessage('reason is required'),
    body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    body('vatPercent').isFloat({ min: 0 }).withMessage('vatPercent must be a non-negative number'),
  ],
  validateRequest,
  createFineRecords
);
router.patch('/fines/:id', updateFineRecord);
router.delete('/fines/:id', deleteFineRecord);
router.get('/fines/:id/attachment', downloadFineAttachment);

router.get('/expense-plans', listExpensePlans);
router.post(
  '/expense-plans',
  [
    body('scopeType').trim().isIn(['group', 'applicant']).withMessage('scopeType must be group or applicant'),
    body('expenseType').trim().isIn(['own-car', 'rented-car']).withMessage('expenseType must be own-car or rented-car'),
    body('startsOn').trim().notEmpty().withMessage('startsOn is required'),
  ],
  validateRequest,
  saveExpensePlan
);
router.patch('/expense-plans/:id', saveExpensePlan);
router.delete('/expense-plans/:id', deleteExpensePlan);

export default router;
