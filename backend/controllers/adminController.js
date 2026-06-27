import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';
import IncomeRecord from '../models/IncomeRecord.js';
import { createAdminToken } from '../services/adminToken.js';
import emailService from '../services/emailService.js';

const allowedStatuses = new Set(['pending', 'reviewed', 'selected', 'rejected']);

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeGroupName = value => String(value || '').trim().replace(/\s+/g, ' ');

const parseBooleanFilter = value => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === false || value === 'false' || value === '0' || value === 0) {
    return false;
  }

  return null;
};

const buildApplicantFilter = query => {
  const filter = {};

  if (query.name) {
    filter.fullName = { $regex: escapeRegex(query.name.trim()), $options: 'i' };
  }

  if (query.email) {
    filter.email = { $regex: escapeRegex(query.email.trim().toLowerCase()), $options: 'i' };
  }

  const hasOwnCar = parseBooleanFilter(query.hasOwnCar);
  if (hasOwnCar !== null) {
    filter.hasOwnCar = hasOwnCar;
  }

  const hasDrivingLicense = parseBooleanFilter(query.hasDrivingLicense);
  if (hasDrivingLicense !== null) {
    filter.hasDrivingLicense = hasDrivingLicense;
  }

  if (query.status && allowedStatuses.has(String(query.status).trim())) {
    filter.status = String(query.status).trim();
  }

  if (query.groupName) {
    const normalizedGroupName = normalizeGroupName(query.groupName);

    if (normalizedGroupName) {
      filter.groupName = {
        $regex: `^${escapeRegex(normalizedGroupName)}$`,
        $options: 'i',
      };
    }
  }

  return filter;
};

const toInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const adminProjection = {
  fullName: 1,
  email: 1,
  phoneNumber: 1,
  hasDrivingLicense: 1,
  hasOwnCar: 1,
  carPlateNumber: 1,
  additionalDescription: 1,
  acceptedTerms: 1,
  status: 1,
  groupId: 1,
  groupName: 1,
  createdAt: 1,
  updatedAt: 1,
};

const pickerIdPrefix = 'P-';
const pickerIdDigits = 4;

const formatPickerId = sequence => `${pickerIdPrefix}${String(sequence).padStart(pickerIdDigits, '0')}`;

const getNextPickerSequence = async () => {
  const accounts = await UserAccount.find({ pickerId: { $regex: new RegExp(`^${pickerIdPrefix}\\d+$`) } })
    .select('pickerId')
    .lean();

  const maxSequence = accounts.reduce((max, account) => {
    const match = String(account.pickerId || '').match(/^P-(\d+)$/);
    if (!match) {
      return max;
    }

    const sequence = Number.parseInt(match[1], 10);
    return Number.isNaN(sequence) ? max : Math.max(max, sequence);
  }, 0);

  return maxSequence + 1;
};

const allocatePickerId = async (state) => {
  let candidate = formatPickerId(state.nextSequence);

  while (await UserAccount.exists({ pickerId: candidate })) {
    state.nextSequence += 1;
    candidate = formatPickerId(state.nextSequence);
  }

  state.nextSequence += 1;
  return candidate;
};

const enrichApplicantsWithUserAccounts = async (applicants) => {
  if (!applicants.length) {
    return applicants;
  }

  const applicantIds = applicants.map(applicant => applicant._id);
  const userAccounts = await UserAccount.find({ applicantId: { $in: applicantIds } })
    .select('applicantId pickerId bankName bankAccountNumber')
    .lean();

  const accountByApplicantId = new Map(userAccounts.map(account => [String(account.applicantId), account]));

  return applicants.map(applicant => {
    const account = accountByApplicantId.get(String(applicant._id));
    if (!account) {
      return applicant;
    }

    return {
      ...applicant,
      pickerId: account.pickerId || '',
      bankName: account.bankName || '',
      bankAccountNumber: account.bankAccountNumber || '',
    };
  });
};

const buildIncomeNotificationEmailHtml = ({ fullName, pickerId, location, berryType, berryWeightKg, carrotWeightKg, amount, calculatedIncome }) => `
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="color: #153b20;">Hi ${fullName},</h2>
        <p>The following income record has been added to your account.</p>
        <p><strong>Record details:</strong></p>
        <ul>
          <li>Picker ID: <strong>${pickerId}</strong></li>
          <li>Location: <strong>${location}</strong></li>
          <li>Berry type: <strong>${berryType}</strong></li>
          <li>Berry wt: <strong>${berryWeightKg}</strong></li>
          <li>Cart wt: <strong>${carrotWeightKg}</strong></li>
          <li>Unit price: <strong>${amount}</strong></li>
          <li>Total amt: <strong>${calculatedIncome}</strong></li>
        </ul>
        <p>Thank you for your hard work!</p>
      </div>
    </body>
  </html>
`;

export const loginAdmin = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ success: false, message: result.array()[0].msg });
  }

  const configuredUsername = process.env.ADMIN_USERNAME?.trim();
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredUsername || !configuredPassword || !process.env.ADMIN_JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'Admin credentials are not configured' });
  }

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const hash = value => crypto.createHash('sha256').update(value).digest();
  const isSameLength = configuredUsername.length === username.length && configuredPassword.length === password.length;
  const usernameMatch = isSameLength && crypto.timingSafeEqual(hash(configuredUsername), hash(username));
  const passwordMatch = isSameLength && crypto.timingSafeEqual(hash(configuredPassword), hash(password));

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = createAdminToken({ username: configuredUsername });

  return res.json({
    success: true,
    message: 'Admin login successful',
    data: {
      token,
      admin: { username: configuredUsername },
    },
  });
};

export const listApplicants = async (req, res, next) => {
  try {
    const filter = buildApplicantFilter(req.query);

    if (req.query.pickerId) {
      const pickerId = String(req.query.pickerId).trim();
      const matchingAccounts = await UserAccount.find({ pickerId: { $regex: escapeRegex(pickerId), $options: 'i' } })
        .select('applicantId')
        .lean();

      filter._id = { $in: matchingAccounts.map(account => account.applicantId) };
    }

    const page = toInt(req.query.page, 1, 1, 1000000);
    const limit = toInt(req.query.limit, 10, 1, 100);
    const skip = (page - 1) * limit;
    const sortField = String(req.query.sortField || 'createdAt');
    const sortDirection = String(req.query.sortDirection || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const [total, applicants] = await Promise.all([
      Applicant.countDocuments(filter),
      Applicant.find(filter)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .select(adminProjection)
        .lean(),
    ]);

    const enrichedApplicants = await enrichApplicantsWithUserAccounts(applicants);

    return res.json({
      success: true,
      data: {
        applicants: enrichedApplicants,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getApplicantById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }

    const applicant = await Applicant.findById(id).select(adminProjection).lean();

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    const [enrichedApplicant] = await enrichApplicantsWithUserAccounts([applicant]);

    const userAccount = await UserAccount.findOne({ applicantId: id })
      .select('bankName bankAccountNumber pickerId')
      .lean();

    const incomeRecords = await IncomeRecord.find({ applicantId: id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const totalIncomeAggregate = await IncomeRecord.aggregate([
      { $match: { applicantId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, totalIncome: { $sum: '$calculatedIncome' } } },
    ]);

    return res.json({
      success: true,
      data: {
        applicant: {
          ...enrichedApplicant,
          pickerId: enrichedApplicant?.pickerId || userAccount?.pickerId || '',
          bankName: enrichedApplicant?.bankName || userAccount?.bankName || '',
          bankAccountNumber: enrichedApplicant?.bankAccountNumber || userAccount?.bankAccountNumber || '',
          incomeRecords,
          totalIncome: totalIncomeAggregate[0]?.totalIncome || 0,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateApplicantStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant id' });
    }

    const nextStatus = String(status || '').trim();

    if (!allowedStatuses.has(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const applicant = await Applicant.findById(id);

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    applicant.status = nextStatus;
    await applicant.save();

    return res.json({
      success: true,
      message: 'Applicant status updated',
      data: { applicant },
    });
  } catch (error) {
    return next(error);
  }
};

export const createUserAccounts = async (req, res, next) => {
  try {
    const { applicantIds, groupAssignments } = req.body;

    if (!Array.isArray(applicantIds) || applicantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Applicant IDs array is required' });
    }

    if (!groupAssignments || typeof groupAssignments !== 'object') {
      return res.status(400).json({ success: false, message: 'Group assignments object is required' });
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    const pickerSequence = { nextSequence: await getNextPickerSequence() };

    for (const applicantId of applicantIds) {
      try {
        if (!mongoose.isValidObjectId(applicantId)) {
          results.errors.push({ applicantId, error: 'Invalid applicant ID' });
          continue;
        }

        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
          results.errors.push({ applicantId, error: 'Applicant not found' });
          continue;
        }

        const groupName = groupAssignments[applicantId];
        if (!groupName) {
          results.errors.push({ applicantId, error: 'No group assigned' });
          continue;
        }

        // Update applicant with group
        applicant.groupName = normalizeGroupName(groupName);
        applicant.status = 'selected';
        await applicant.save();

        // Check if user account already exists
        let userAccount = await UserAccount.findOne({ email: applicant.email });

        if (!userAccount) {
          // Generate temporary password
          const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase();
          const passwordHash = await bcrypt.hash(tempPassword, 10);
          const pickerId = await allocatePickerId(pickerSequence);

          userAccount = new UserAccount({
            applicantId: applicant._id,
            fullName: applicant.fullName,
            email: applicant.email,
            pickerId,
            passwordHash,
            mustChangePassword: true,
          });

          await userAccount.save();

          results.created.push({
            applicantId,
            email: applicant.email,
            pickerId,
            tempPassword,
            groupName,
          });

          // Send onboarding email
          try {
            await emailService.sendUserOnboardingEmail({
              email: applicant.email,
              fullName: applicant.fullName,
              pickerId,
              tempPassword,
              groupName,
            });
          } catch (emailErr) {
            console.warn(`Failed to send email to ${applicant.email}:`, emailErr.message);
          }
        } else {
          if (!userAccount.pickerId) {
            userAccount.pickerId = await allocatePickerId(pickerSequence);
            await userAccount.save();
          }

          results.updated.push({
            applicantId,
            email: applicant.email,
            pickerId: userAccount.pickerId,
            groupName,
          });
        }
      } catch (itemErr) {
        results.errors.push({
          applicantId,
          error: itemErr.message || 'Unknown error',
        });
      }
    }

    return res.json({
      success: true,
      message: 'User account creation completed',
      data: results,
    });
  } catch (error) {
    return next(error);
  }
};

export const addIncomeRecord = async (req, res, next) => {
  try {
    const { applicantId, date, location, berryType, berryWeightKg, carrotWeightKg, amount } = req.body;

    if (!applicantId || !date || !location || !berryType || berryWeightKg === undefined || carrotWeightKg === undefined || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'applicantId, date, location, berryType, berryWeightKg, carrotWeightKg, and amount are required',
      });
    }

    if (!mongoose.isValidObjectId(applicantId)) {
      return res.status(400).json({ success: false, message: 'Invalid applicant ID' });
    }

    const applicant = await Applicant.findById(applicantId);
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    const berryWeight = Number(berryWeightKg);
    const carrotWeight = Number(carrotWeightKg);
    const amountVal = Number(amount);

    if (Number.isNaN(berryWeight) || berryWeight < 0) {
      return res.status(400).json({ success: false, message: 'berryWeightKg must be a non-negative number' });
    }

    if (Number.isNaN(carrotWeight) || carrotWeight < 0) {
      return res.status(400).json({ success: false, message: 'carrotWeightKg must be a non-negative number' });
    }

    if (Number.isNaN(amountVal) || amountVal < 0) {
      return res.status(400).json({ success: false, message: 'amount must be a non-negative number' });
    }

    const berryTypeValue = String(berryType).trim();
    if (!berryTypeValue) {
      return res.status(400).json({ success: false, message: 'berryType is required' });
    }

    const locationValue = String(location).trim();
    if (!locationValue) {
      return res.status(400).json({ success: false, message: 'location is required' });
    }

    // Calculate income: (berry - carrot) * amount
    const calculatedIncome = (berryWeight - carrotWeight) * amountVal;

    const recordDate = new Date(date);
    if (Number.isNaN(recordDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // Set time to start of day
    recordDate.setUTCHours(0, 0, 0, 0);

    let incomeRecord = await IncomeRecord.findOne({ applicantId, date: recordDate });

    if (incomeRecord) {
      incomeRecord.location = locationValue;
      incomeRecord.berryType = berryTypeValue;
      incomeRecord.berryWeightKg = berryWeight;
      incomeRecord.carrotWeightKg = carrotWeight;
      incomeRecord.amount = amountVal;
      incomeRecord.calculatedIncome = calculatedIncome;
      await incomeRecord.save();
    } else {
      incomeRecord = new IncomeRecord({
        applicantId,
        date: recordDate,
        location: locationValue,
        berryType: berryTypeValue,
        berryWeightKg: berryWeight,
        carrotWeightKg: carrotWeight,
        amount: amountVal,
        calculatedIncome,
      });
      await incomeRecord.save();
    }

    const userAccount = await UserAccount.findOne({ applicantId }).lean();
    if (userAccount) {
      try {
        await emailService.sendIncomeEntryEmail({
          email: userAccount.email,
          fullName: userAccount.fullName,
          pickerId: userAccount.pickerId || '',
          location: locationValue,
          berryType: berryTypeValue,
          berryWeightKg: berryWeight,
          carrotWeightKg: carrotWeight,
          amount: amountVal,
          calculatedIncome,
        });
      } catch (emailErr) {
        console.warn(`Failed to send income email to ${userAccount.email}:`, emailErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Income record saved',
      data: { incomeRecord },
    });
  } catch (error) {
    return next(error);
  }
};

export const listIncomeRecords = async (req, res, next) => {
  try {
    const { applicantId, startDate, endDate, limit = 50, page = 1 } = req.query;

    const filter = {};

    if (applicantId) {
      if (!mongoose.isValidObjectId(applicantId)) {
        return res.status(400).json({ success: false, message: 'Invalid applicant ID' });
      }
      filter.applicantId = new mongoose.Types.ObjectId(applicantId);
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid startDate format' });
        }
        filter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid endDate format' });
        }
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(Number(limit), 100));
    const skip = (pageNum - 1) * limitNum;

    const [total, records] = await Promise.all([
      IncomeRecord.countDocuments(filter),
      IncomeRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalIncomeAggregate = await IncomeRecord.aggregate([
      { $match: filter },
      { $group: { _id: null, totalIncome: { $sum: '$calculatedIncome' } } },
    ]);

    return res.json({
      success: true,
      data: {
        records,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        totalIncome: totalIncomeAggregate[0]?.totalIncome || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};
