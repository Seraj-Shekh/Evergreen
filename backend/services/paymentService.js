import mongoose from 'mongoose';
import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';
import IncomeRecord from '../models/IncomeRecord.js';
import ExpenseRecord from '../models/ExpenseRecord.js';
import PaymentRecord from '../models/PaymentRecord.js';
import { getFineSummaryForApplicant } from './fineService.js';
import { ensureExpenseRecordsForApplicant } from './expenseService.js';

const toUtcDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addOneDay = value => {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const runWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
};

const endOfUtcDay = value => {
  const date = toUtcDate(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const startOfUtcDay = value => {
  const date = toUtcDate(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const buildRangeFilter = ({ applicantId, fromDate, toDate }) => {
  const filter = { applicantId: new mongoose.Types.ObjectId(applicantId) };

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) {
      filter.date.$gte = startOfUtcDay(fromDate);
    }
    if (toDate) {
      filter.date.$lte = endOfUtcDay(toDate);
    }
  }

  return filter;
};

const normalizePeriod = (fromDate, toDate) => {
  const normalizedFromDate = fromDate ? startOfUtcDay(fromDate) : null;
  const normalizedToDate = toDate ? endOfUtcDay(toDate) : null;

  if (normalizedFromDate && normalizedToDate && normalizedToDate < normalizedFromDate) {
    throw new Error('toDate cannot be earlier than fromDate');
  }

  return { normalizedFromDate, normalizedToDate };
};

export const getPaymentSummaryForApplicant = async ({ applicantId, fromDate, toDate }) => {
  if (!mongoose.isValidObjectId(applicantId)) {
    throw new Error('Valid applicantId is required');
  }

  const applicant = await Applicant.findById(applicantId).select('_id fullName email pickerId groupName createdAt').lean();
  if (!applicant) {
    throw new Error('Applicant not found');
  }

  const { normalizedFromDate, normalizedToDate } = normalizePeriod(fromDate, toDate);
  const latestEndDate = normalizedToDate || new Date();

  await ensureExpenseRecordsForApplicant(applicantId, latestEndDate);

  const filter = buildRangeFilter({
    applicantId,
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
  });

  const [incomeRecords, expenseRecords, incomeAggregate, expenseAggregate, fineSummary] = await Promise.all([
    IncomeRecord.find(filter).sort({ date: 1, createdAt: 1 }).lean(),
    ExpenseRecord.find(filter).sort({ date: 1, createdAt: 1 }).lean(),
    IncomeRecord.aggregate([
      { $match: filter },
      { $group: { _id: null, totalIncome: { $sum: '$calculatedIncome' } } },
    ]),
    ExpenseRecord.aggregate([
      { $match: filter },
      { $group: { _id: null, totalExpense: { $sum: '$calculatedExpense' } } },
    ]),
    getFineSummaryForApplicant({ applicantId, fromDate: normalizedFromDate, toDate: normalizedToDate }),
  ]);

  const incomeTotal = incomeAggregate[0]?.totalIncome || 0;
  const expenseTotal = expenseAggregate[0]?.totalExpense || 0;
  const fineTotal = fineSummary?.fineTotal || 0;

  return {
    applicant,
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
    incomeRecords,
    expenseRecords,
    fineRecords: fineSummary?.fineRecords || [],
    incomeTotal,
    expenseTotal,
    fineTotal,
    netPayable: incomeTotal - expenseTotal - fineTotal,
  };
};

export const listPaymentRecordsForApplicant = async applicantId => {
  if (!mongoose.isValidObjectId(applicantId)) {
    throw new Error('Valid applicantId is required');
  }

  return PaymentRecord.find({ applicantId }).sort({ paidAt: -1, createdAt: -1 }).lean();
};

export const createPaymentRecord = async ({ applicantId, fromDate, toDate, paidAmount, paidBy, notes }) => {
  const summary = await getPaymentSummaryForApplicant({ applicantId, fromDate, toDate });
  const resolvedPaidAmount = paidAmount === undefined || paidAmount === null || paidAmount === ''
    ? summary.netPayable
    : Number(paidAmount);

  if (!Number.isFinite(resolvedPaidAmount)) {
    throw new Error('paidAmount must be a valid number');
  }

  const paymentRecord = await PaymentRecord.create({
    applicantId: summary.applicant._id,
    fromDate: summary.fromDate || summary.applicant.createdAt,
    toDate: summary.toDate || new Date(),
    incomeTotal: summary.incomeTotal,
    expenseTotal: summary.expenseTotal,
    fineTotal: summary.fineTotal,
    netPayable: summary.netPayable,
    paidAmount: resolvedPaidAmount,
    paidBy: String(paidBy || '').trim(),
    notes: String(notes || '').trim(),
    currency: 'EUR',
    paidAt: new Date(),
    status: 'paid',
  });

  return { summary, paymentRecord };
};

export const listOutstandingPayments = async () => {
  const latestIncomeByApplicant = await IncomeRecord.aggregate([
    { $group: { _id: '$applicantId', latestIncomeDate: { $max: '$date' } } },
  ]);

  if (!latestIncomeByApplicant.length) {
    return [];
  }

  const applicantIds = latestIncomeByApplicant.map(entry => entry._id);

  const [lastPaymentByApplicant, applicants, userAccounts] = await Promise.all([
    PaymentRecord.aggregate([
      { $match: { applicantId: { $in: applicantIds } } },
      { $group: { _id: '$applicantId', lastPaidToDate: { $max: '$toDate' } } },
    ]),
    Applicant.find({ _id: { $in: applicantIds } }).select('_id fullName email groupName createdAt').lean(),
    UserAccount.find({ applicantId: { $in: applicantIds } }).select('applicantId pickerId').lean(),
  ]);

  const lastPaidToDateByApplicantId = new Map(lastPaymentByApplicant.map(entry => [String(entry._id), entry.lastPaidToDate]));
  const applicantById = new Map(applicants.map(applicant => [String(applicant._id), applicant]));
  const pickerIdByApplicantId = new Map(userAccounts.map(account => [String(account.applicantId), account.pickerId || '']));

  const candidates = latestIncomeByApplicant
    .map(entry => {
      const applicantId = String(entry._id);
      const applicant = applicantById.get(applicantId);
      if (!applicant) {
        return null;
      }

      const latestIncomeDate = toUtcDate(entry.latestIncomeDate);
      const lastPaidToDate = lastPaidToDateByApplicantId.get(applicantId);
      const outstandingFromDate = lastPaidToDate
        ? addOneDay(lastPaidToDate)
        : toUtcDate(applicant.createdAt || latestIncomeDate);

      if (outstandingFromDate > latestIncomeDate) {
        return null;
      }

      return { applicantId, applicant, lastPaidToDate, outstandingFromDate, latestIncomeDate };
    })
    .filter(Boolean);

  // Resolve applicant summaries with bounded concurrency instead of one at a time -
  // sequential awaits here previously caused this endpoint to time out in production
  // once the picker roster grew, since each summary is several DB round trips.
  const resolvedCandidates = await runWithConcurrency(candidates, 10, async candidate => {
    const summary = await getPaymentSummaryForApplicant({
      applicantId: candidate.applicantId,
      fromDate: candidate.outstandingFromDate,
      toDate: candidate.latestIncomeDate,
    });

    return { candidate, summary };
  });

  const outstandingEntries = resolvedCandidates
    .filter(({ summary }) => summary.netPayable > 0)
    .map(({ candidate, summary }) => ({
      applicantId: candidate.applicantId,
      fullName: candidate.applicant.fullName,
      email: candidate.applicant.email,
      groupName: candidate.applicant.groupName || '',
      pickerId: pickerIdByApplicantId.get(candidate.applicantId) || '',
      lastPaidToDate: candidate.lastPaidToDate || null,
      outstandingFromDate: candidate.outstandingFromDate,
      outstandingToDate: candidate.latestIncomeDate,
      incomeTotal: summary.incomeTotal,
      expenseTotal: summary.expenseTotal,
      fineTotal: summary.fineTotal,
      outstandingAmount: summary.netPayable,
    }));

  outstandingEntries.sort((left, right) => right.outstandingAmount - left.outstandingAmount);

  return outstandingEntries;
};