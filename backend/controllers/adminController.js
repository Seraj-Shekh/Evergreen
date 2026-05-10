import crypto from 'crypto';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Applicant from '../models/Applicant.js';
import { createAdminToken } from '../services/adminToken.js';

const allowedStatuses = new Set(['pending', 'reviewed', 'selected', 'rejected']);

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  createdAt: 1,
  updatedAt: 1,
};

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

    return res.json({
      success: true,
      data: {
        applicants,
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

    return res.json({ success: true, data: { applicant } });
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
