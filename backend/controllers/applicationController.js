import Applicant from '../models/Applicant.js';
import emailService from '../services/emailService.js';

const toBoolean = value => value === true || value === 'true' || value === 'Yes' || value === 'yes';

const normalizeText = value => (typeof value === 'string' ? value.trim() : '');

export const createApplication = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      hasDrivingLicense,
      hasOwnCar,
      carPlateNumber,
      additionalDescription,
      acceptedTerms,
    } = req.body;

    const normalizedEmail = normalizeText(email).toLowerCase();

    // Check for existing application with same email (case-insensitive)
    const existing = await Applicant.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An application with this email address already exists',
      });
    }

    const applicant = await Applicant.create({
      fullName: normalizeText(fullName),
      email: normalizedEmail,
      phoneNumber: normalizeText(phoneNumber),
      hasDrivingLicense: toBoolean(hasDrivingLicense),
      hasOwnCar: toBoolean(hasOwnCar),
      carPlateNumber: toBoolean(hasOwnCar) ? normalizeText(carPlateNumber) : '',
      additionalDescription: normalizeText(additionalDescription),
      acceptedTerms: toBoolean(acceptedTerms),
      status: 'pending',
    });

    await emailService.sendApplicationConfirmation(applicant);

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { id: applicant._id },
    });
  } catch (error) {
    return next(error);
  }
};
