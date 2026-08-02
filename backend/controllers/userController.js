import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';
import IncomeRecord from '../models/IncomeRecord.js';
import ExpenseRecord from '../models/ExpenseRecord.js';
import PaymentRecord from '../models/PaymentRecord.js';
import { createUserToken } from '../services/userToken.js';
import emailService from '../services/emailService.js';
import { ensureExpenseRecordsForApplicant, getCurrentExpensePlanForApplicant } from '../services/expenseService.js';

const sanitizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeGroupName = value => String(value || '').trim().replace(/\s+/g, ' ');
const hashResetToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

const normalizeBaseUrl = value => {
  if (!value) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  return trimmed.replace(/\/$/, '');
};

export const getClientUrl = req => {
  const candidates = [
    req?.headers?.origin,
    req?.headers?.referer && (() => {
      try {
        return new URL(req.headers.referer).origin;
      } catch {
        return '';
      }
    })(),
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.VITE_APP_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'https://evergreen-harvest-berry.netlify.app';
};

export const buildResetPasswordUrl = (req, token) => `${getClientUrl(req)}/portal/reset-password?token=${encodeURIComponent(token)}`;

export const loginUser = async (req, res, next) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || '');

    const user = await UserAccount.findOne({ email }).lean();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await UserAccount.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).lean();

    const token = createUserToken({ userId: user._id, email: user.email, applicantId: user.applicantId });

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        mustChangePassword: Boolean(user.mustChangePassword),
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          pickerId: user.pickerId,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const email = sanitizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const user = await UserAccount.findOne({ email });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = hashResetToken(resetToken);
      user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const resetUrl = buildResetPasswordUrl(req, resetToken);

      try {
        await emailService.sendPasswordResetEmail({
          email: user.email,
          fullName: user.fullName,
          resetUrl,
        });
      } catch (emailError) {
        console.warn(`Failed to send password reset email to ${user.email}:`, emailError.message);
      }
    }

    return res.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }

    const tokenHash = hashResetToken(token);
    const user = await UserAccount.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = nextHash;
    user.mustChangePassword = false;
    user.resetPasswordTokenHash = '';
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await UserAccount.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const applicant = await Applicant.findById(user.applicantId).lean();

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          mustChangePassword: Boolean(user.mustChangePassword),
          pickerId: user.pickerId,
          bankName: user.bankName || '',
          bankAccountNumber: user.bankAccountNumber || '',
        },
        applicant: applicant ? {
          id: applicant._id,
          status: applicant.status,
          submittedAt: applicant.createdAt,
          phoneNumber: applicant.phoneNumber,
          groupId: applicant.groupId || '',
          groupName: applicant.groupName || '',
        } : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    const user = await UserAccount.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);

    user.passwordHash = nextHash;
    user.mustChangePassword = false;
    await user.save();

    return res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    return next(error);
  }
};

export const updatePhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const phoneNumber = String(req.body.phoneNumber || '').trim();

    const user = await UserAccount.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const applicant = await Applicant.findById(user.applicantId);

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found' });
    }

    applicant.phoneNumber = phoneNumber;
    await applicant.save();

    return res.json({
      success: true,
      message: 'Phone number updated',
      data: {
        phoneNumber: applicant.phoneNumber,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateBankDetails = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const bankName = String(req.body.bankName || '').trim();
    const bankAccountNumber = String(req.body.bankAccountNumber || '').trim();

    if (!bankName || !bankAccountNumber) {
      return res.status(400).json({ success: false, message: 'bankName and bankAccountNumber are required' });
    }

    const user = await UserAccount.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.bankName = bankName;
    user.bankAccountNumber = bankAccountNumber;
    await user.save();

    return res.json({
      success: true,
      message: 'Bank details updated',
      data: {
        bankName: user.bankName,
        bankAccountNumber: user.bankAccountNumber,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getGroupMembers = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await UserAccount.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const applicant = await Applicant.findById(user.applicantId).lean();

    if (!applicant || !applicant.groupName) {
      return res.json({
        success: true,
        data: {
          groupName: applicant?.groupName || '',
          members: [],
        },
      });
    }

    const groupMembers = await Applicant.find({
      groupName: {
        $regex: `^${normalizeGroupName(applicant.groupName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      },
    })
      .select(['_id', 'fullName', 'email', 'phoneNumber', 'groupName'])
      .lean();

    return res.json({
      success: true,
      data: {
        groupName: applicant.groupName,
        members: groupMembers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getIncomeHistory = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { startDate, endDate, limit = 50, page = 1 } = req.query;

    const user = await UserAccount.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const filter = { applicantId: user.applicantId };

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

    const [total, records, totalIncomeAggregate] = await Promise.all([
      IncomeRecord.countDocuments(filter),
      IncomeRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      IncomeRecord.aggregate([
        { $match: filter },
        { $group: { _id: null, totalIncome: { $sum: '$calculatedIncome' } } },
      ]),
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

export const getExpenseHistory = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { startDate, endDate, limit = 50, page = 1 } = req.query;

    const user = await UserAccount.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await ensureExpenseRecordsForApplicant(user.applicantId, new Date());

    const filter = { applicantId: user.applicantId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          filter.date.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }
      if (Object.keys(filter.date).length === 0) {
        delete filter.date;
      }
    }

    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const skip = (pageNumber - 1) * pageLimit;

    const [records, total, totalAggregate, currentPlan] = await Promise.all([
      ExpenseRecord.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      ExpenseRecord.countDocuments(filter),
      ExpenseRecord.aggregate([
        { $match: filter },
        { $group: { _id: null, totalExpense: { $sum: '$calculatedExpense' } } },
      ]),
      getCurrentExpensePlanForApplicant(user.applicantId),
    ]);

    return res.json({
      success: true,
      data: {
        records,
        page: pageNumber,
        limit: pageLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageLimit)),
        totalExpense: totalAggregate[0]?.totalExpense || 0,
        currentPlan,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentHistory = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await UserAccount.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const paymentRecords = await PaymentRecord.find({ applicantId: user.applicantId })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: { paymentRecords },
    });
  } catch (error) {
    return next(error);
  }
};
