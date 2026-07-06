import mongoose from 'mongoose';
import Applicant from '../models/Applicant.js';
import ExpensePlan from '../models/ExpensePlan.js';
import ExpenseRecord from '../models/ExpenseRecord.js';

const EXPENSE_TYPE_DEFAULTS = {
  'own-car': {
    label: 'Own car',
    dailyAmount: 7.5,
    description: 'Accommodation + trailer cost',
  },
  'rented-car': {
    label: 'Rented car',
    dailyAmount: 11,
    description: 'Car rent + accommodation + trailer cost',
  },
};

const normalizeGroupName = value => String(value || '').trim().replace(/\s+/g, ' ');

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildExactGroupRegex = value => {
  const normalized = normalizeGroupName(value);
  if (!normalized) {
    return null;
  }

  return new RegExp(`^${escapeRegex(normalized)}$`, 'i');
};

const toUtcDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isSameOrBefore = (left, right) => toUtcDate(left).getTime() <= toUtcDate(right).getTime();
const isSameOrAfter = (left, right) => toUtcDate(left).getTime() >= toUtcDate(right).getTime();

export const getExpenseTypeDefaults = expenseType => EXPENSE_TYPE_DEFAULTS[expenseType] || EXPENSE_TYPE_DEFAULTS['own-car'];
export const getExpenseTypeLabel = expenseType => getExpenseTypeDefaults(expenseType).label;
export { normalizeGroupName, buildExactGroupRegex, toUtcDate, addDays };

const choosePlanForDate = (plans, date) => {
  const targetDate = toUtcDate(date);

  const eligiblePlans = plans.filter(plan => {
    if (!isSameOrBefore(plan.startsOn, targetDate)) {
      return false;
    }

    if (plan.endsOn && !isSameOrAfter(plan.endsOn, targetDate)) {
      return false;
    }

    return true;
  });

  if (!eligiblePlans.length) {
    return null;
  }

  const scopePriority = plan => (plan.scopeType === 'applicant' ? 0 : 1);

  return [...eligiblePlans].sort((left, right) => {
    const scopeDiff = scopePriority(left) - scopePriority(right);
    if (scopeDiff !== 0) {
      return scopeDiff;
    }

    const startDiff = toUtcDate(right.startsOn).getTime() - toUtcDate(left.startsOn).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
  })[0];
};

const getRelevantPlansForApplicant = async applicant => {
  const groupRegex = buildExactGroupRegex(applicant.groupName);
  const query = {
    $or: [
      { scopeType: 'applicant', applicantId: applicant._id },
    ],
  };

  if (groupRegex) {
    query.$or.push({ scopeType: 'group', groupName: groupRegex });
  }

  return ExpensePlan.find(query).sort({ startsOn: -1, updatedAt: -1 }).lean();
};

const getPlansByScope = async plan => {
  if (plan.scopeType === 'applicant') {
    return Applicant.find({ _id: plan.applicantId }).select('_id groupName fullName').lean();
  }

  const groupRegex = buildExactGroupRegex(plan.groupName);
  if (!groupRegex) {
    return [];
  }

  return Applicant.find({ groupName: groupRegex }).select('_id groupName fullName').lean();
};

const buildExpenseRecord = (applicant, date, plan) => {
  const defaults = getExpenseTypeDefaults(plan.expenseType);
  const dailyAmount = Number.isFinite(Number(plan.dailyAmount)) ? Number(plan.dailyAmount) : defaults.dailyAmount;
  const normalizedDate = toUtcDate(date);

  return {
    applicantId: applicant._id,
    date: normalizedDate,
    groupName: normalizeGroupName(applicant.groupName),
    scopeType: plan.scopeType,
    expenseType: plan.expenseType,
    dailyAmount,
    currency: plan.currency || 'EUR',
    calculatedExpense: dailyAmount,
    planId: plan._id,
    notes: plan.notes || defaults.description,
  };
};

const fillExpenseRecordsForApplicantRange = async (applicant, startDate, endDate) => {
  const plans = await getRelevantPlansForApplicant(applicant);
  if (!plans.length) {
    return { createdCount: 0 };
  }

  const normalizedStart = toUtcDate(startDate);
  const normalizedEnd = toUtcDate(endDate);
  const existingRecords = await ExpenseRecord.find({
    applicantId: applicant._id,
    date: { $gte: normalizedStart, $lte: normalizedEnd },
  })
    .select('_id date')
    .lean();

  const existingDates = new Set(existingRecords.map(record => toUtcDate(record.date).toISOString().slice(0, 10)));
  let createdCount = 0;

  for (let cursor = new Date(normalizedStart); cursor <= normalizedEnd; cursor = addDays(cursor, 1)) {
    const dateKey = cursor.toISOString().slice(0, 10);
    if (existingDates.has(dateKey)) {
      continue;
    }

    const plan = choosePlanForDate(plans, cursor);
    if (!plan) {
      continue;
    }

    await ExpenseRecord.create(buildExpenseRecord(applicant, cursor, plan));
    createdCount += 1;
  }

  return { createdCount };
};

export const ensureExpenseRecordsForApplicant = async (applicantId, upToDate = new Date()) => {
  const applicant = await Applicant.findById(applicantId).select('_id groupName fullName createdAt').lean();
  if (!applicant) {
    return { createdCount: 0 };
  }

  const latestRecord = await ExpenseRecord.findOne({ applicantId: applicant._id }).sort({ date: -1 }).select('date').lean();
  const plans = await getRelevantPlansForApplicant(applicant);

  if (!plans.length && !latestRecord) {
    return { createdCount: 0 };
  }

  const today = toUtcDate(upToDate);
  const startFromPlan = plans.length ? new Date(Math.min(...plans.map(plan => toUtcDate(plan.startsOn).getTime()))) : toUtcDate(applicant.createdAt || today);
  const startDate = latestRecord ? addDays(toUtcDate(latestRecord.date), 1) : startFromPlan;

  if (startDate > today) {
    return { createdCount: 0 };
  }

  return fillExpenseRecordsForApplicantRange(applicant, startDate, today);
};

export const rebuildExpenseRecordsForPlan = async (plan, upToDate = new Date()) => {
  const planDoc = plan?.toObject ? plan.toObject() : plan;
  if (!planDoc) {
    return { affectedApplicants: 0, createdCount: 0 };
  }

  const targetApplicants = await getPlansByScope(planDoc);
  if (!targetApplicants.length) {
    return { affectedApplicants: 0, createdCount: 0 };
  }

  const normalizedStart = toUtcDate(planDoc.startsOn);
  const normalizedEnd = toUtcDate(planDoc.endsOn || upToDate);

  let createdCount = 0;

  for (const applicant of targetApplicants) {
    await ExpenseRecord.deleteMany({
      applicantId: applicant._id,
      date: { $gte: normalizedStart },
    });

    const result = await fillExpenseRecordsForApplicantRange(applicant, normalizedStart, normalizedEnd);
    createdCount += result.createdCount;
  }

  return { affectedApplicants: targetApplicants.length, createdCount };
};

export const getCurrentExpensePlanForApplicant = async applicantId => {
  const applicant = await Applicant.findById(applicantId).select('_id groupName fullName').lean();
  if (!applicant) {
    return null;
  }

  const plans = await getRelevantPlansForApplicant(applicant);
  if (!plans.length) {
    return null;
  }

  return choosePlanForDate(plans, new Date());
};

export const getExpenseSummaryForApplicant = async applicantId => {
  const [currentPlan, totalAggregate] = await Promise.all([
    getCurrentExpensePlanForApplicant(applicantId),
    ExpenseRecord.aggregate([
      { $match: { applicantId: new mongoose.Types.ObjectId(applicantId) } },
      { $group: { _id: null, totalExpense: { $sum: '$calculatedExpense' } } },
    ]),
  ]);

  return {
    currentPlan,
    totalExpense: totalAggregate[0]?.totalExpense || 0,
  };
};
