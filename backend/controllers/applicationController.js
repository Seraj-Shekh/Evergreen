import Applicant from '../models/Applicant.js';

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

    const applicant = await Applicant.create({
      fullName: normalizeText(fullName),
      email: normalizeText(email).toLowerCase(),
      phoneNumber: normalizeText(phoneNumber),
      hasDrivingLicense: toBoolean(hasDrivingLicense),
      hasOwnCar: toBoolean(hasOwnCar),
      carPlateNumber: toBoolean(hasOwnCar) ? normalizeText(carPlateNumber) : '',
      additionalDescription: normalizeText(additionalDescription),
      acceptedTerms: toBoolean(acceptedTerms),
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { id: applicant._id },
    });
  } catch (error) {
    return next(error);
  }
};
