import { Router } from 'express';
import { body } from 'express-validator';
import { createApplication } from '../controllers/applicationController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post(
  '/',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 120 }),
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 7, max: 32 }),
    body('hasDrivingLicense').isBoolean().withMessage('Driving license response is required'),
    body('hasOwnCar').isBoolean().withMessage('Car ownership response is required'),
    body('carPlateNumber').custom((value, { req }) => {
      if (req.body.hasOwnCar === true || req.body.hasOwnCar === 'true') {
        return typeof value === 'string' && value.trim().length > 0;
      }

      return true;
    }).withMessage('Car plate number is required when you have a car'),
    body('additionalDescription').optional().isString().isLength({ max: 2000 }),
    body('acceptedTerms').custom(value => value === true || value === 'true').withMessage('Terms acceptance is required'),
  ],
  validateRequest,
  createApplication
);

export default router;
