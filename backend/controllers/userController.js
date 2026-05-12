import bcrypt from 'bcryptjs';
import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';
import { createUserToken } from '../services/userToken.js';

const sanitizeEmail = value => String(value || '').trim().toLowerCase();

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
        },
      },
    });
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
        },
        applicant: applicant ? {
          id: applicant._id,
          status: applicant.status,
          submittedAt: applicant.createdAt,
          phoneNumber: applicant.phoneNumber,
          groupId: applicant.groupId || '',
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
