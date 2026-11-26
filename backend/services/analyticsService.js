import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';
import IncomeRecord from '../models/IncomeRecord.js';
import ExpenseRecord from '../models/ExpenseRecord.js';
import FineRecord from '../models/FineRecord.js';
import { ensureExpenseRecordsForApplicant } from './expenseService.js';
import { runWithConcurrency } from './paymentService.js';

const toUtcDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const startOfUtcDay = value => toUtcDate(value);

const endOfUtcDay = value => {
  const date = toUtcDate(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const roundTo2 = value => Math.round((Number(value) || 0) * 100) / 100;

const average = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const capitalizeLabel = value => {
  const text = String(value || '').trim();
  if (!text) {
    return 'Unknown';
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Collapses a chronological list of {date, amount} points into contiguous date ranges that
// shared the same rate, e.g. "Jul 1 - Jul 14 @ 3.00", "Jul 15 - Aug 2 @ 3.50".
const buildPriceRanges = datedRates => {
  const sorted = [...datedRates].sort((left, right) => left.date - right.date);
  const ranges = [];

  for (const point of sorted) {
    const current = ranges[ranges.length - 1];
    if (current && Math.abs(current.ratePerKg - point.amount) < 0.001) {
      current.toDate = point.date;
    } else {
      ranges.push({ fromDate: point.date, toDate: point.date, ratePerKg: roundTo2(point.amount) });
    }
  }

  return ranges;
};

export const getIncomeDateRange = async () => {
  const [result] = await IncomeRecord.aggregate([
    { $group: { _id: null, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } },
  ]);

  return {
    minDate: result?.minDate || null,
    maxDate: result?.maxDate || null,
  };
};

// Independent of getSeasonAnalytics's own reporting-period range - this has its own fromDate/toDate
// so the admin can check a specific window (e.g. one week) without changing the season-wide figures.
export const getDailyBerryPicked = async ({ fromDate, toDate }) => {
  const rangeStart = fromDate ? startOfUtcDay(fromDate) : null;
  const rangeEnd = toDate ? endOfUtcDay(toDate) : null;

  if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
    throw new Error('toDate cannot be earlier than fromDate');
  }

  const dateFilter = {};
  if (rangeStart) {
    dateFilter.$gte = rangeStart;
  }
  if (rangeEnd) {
    dateFilter.$lte = rangeEnd;
  }

  const match = {
    berryWeightKg: { $gt: 0 },
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const dailyByTypeAggregate = await IncomeRecord.aggregate([
    { $match: match },
    {
      $project: {
        date: 1,
        berryTypeKey: { $trim: { input: { $toLower: { $ifNull: ['$berryType', 'unknown'] } } } },
        netKg: { $subtract: ['$berryWeightKg', '$carrotWeightKg'] },
      },
    },
    {
      $group: {
        _id: { date: '$date', berryTypeKey: '$berryTypeKey' },
        kg: { $sum: '$netKg' },
        recordCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Pivot (date, berryType) rows into one row per date with a column per berry type, and
  // discover every berry type present so the UI can render a consistent set of columns.
  const berryTypeLabelByKey = new Map();
  const byDate = new Map();

  for (const row of dailyByTypeAggregate) {
    const { date, berryTypeKey } = row._id;
    const dateKey = new Date(date).getTime();
    const label = capitalizeLabel(berryTypeKey);
    berryTypeLabelByKey.set(berryTypeKey, label);

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { date: new Date(date), totalKg: 0, recordCount: 0, byType: {} });
    }

    const dayEntry = byDate.get(dateKey);
    const kg = roundTo2(row.kg || 0);
    dayEntry.byType[label] = roundTo2((dayEntry.byType[label] || 0) + kg);
    dayEntry.totalKg = roundTo2(dayEntry.totalKg + kg);
    dayEntry.recordCount += row.recordCount || 0;
  }

  const berryTypes = Array.from(berryTypeLabelByKey.values()).sort((left, right) => left.localeCompare(right));

  const dailyBerryPicked = Array.from(byDate.values())
    .sort((left, right) => left.date - right.date)
    .map(day => ({
      date: day.date,
      totalKg: day.totalKg,
      recordCount: day.recordCount,
      byType: berryTypes.reduce((accumulator, type) => {
        accumulator[type] = day.byType[type] || 0;
        return accumulator;
      }, {}),
    }));

  const totalKg = roundTo2(dailyBerryPicked.reduce((sum, day) => sum + day.totalKg, 0));

  // Total per berry type across the whole filtered range (not just per day), e.g. total
  // Blueberry and total Lingonberry, so they're visible alongside the combined grand total.
  const totalsByType = berryTypes.reduce((accumulator, type) => {
    accumulator[type] = roundTo2(dailyBerryPicked.reduce((sum, day) => sum + (day.byType[type] || 0), 0));
    return accumulator;
  }, {});

  return {
    range: { fromDate: rangeStart, toDate: rangeEnd },
    totalKg,
    berryTypes,
    totalsByType,
    dailyBerryPicked,
  };
};

export const getSeasonAnalytics = async ({ fromDate, toDate }) => {
  const availableRange = await getIncomeDateRange();

  const rangeStart = fromDate ? startOfUtcDay(fromDate) : (availableRange.minDate ? toUtcDate(availableRange.minDate) : null);
  const rangeEnd = toDate ? endOfUtcDay(toDate) : (availableRange.maxDate ? endOfUtcDay(availableRange.maxDate) : null);

  if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
    throw new Error('toDate cannot be earlier than fromDate');
  }

  const dateFilter = {};
  if (rangeStart) {
    dateFilter.$gte = rangeStart;
  }
  if (rangeEnd) {
    dateFilter.$lte = rangeEnd;
  }

  const incomeMatch = Object.keys(dateFilter).length ? { date: dateFilter } : {};

  // A record with 0 berry weight is a deliberate "did not pick that day" marker, not a real
  // picking day - it must not count toward days worked, berry totals, or pricing stats.
  const workedMatch = { ...incomeMatch, berryWeightKg: { $gt: 0 } };

  const [grossByApplicant, kgByApplicant, workingDaysByApplicant, fineByApplicant, berryTypeAggregate, nonWorkingRecordCount, berryTypeDateRates] = await Promise.all([
    IncomeRecord.aggregate([
      { $match: incomeMatch },
      { $group: { _id: '$applicantId', grossEarnings: { $sum: '$calculatedIncome' } } },
    ]),
    IncomeRecord.aggregate([
      { $match: incomeMatch },
      { $group: { _id: '$applicantId', kgPicked: { $sum: { $subtract: ['$berryWeightKg', '$carrotWeightKg'] } } } },
    ]),
    IncomeRecord.aggregate([
      { $match: workedMatch },
      { $group: { _id: '$applicantId', daysWorked: { $addToSet: '$date' } } },
      { $project: { daysWorkedCount: { $size: '$daysWorked' } } },
    ]),
    FineRecord.aggregate([
      { $match: incomeMatch },
      { $group: { _id: '$applicantId', fineTotal: { $sum: '$netAmount' } } },
    ]),
    IncomeRecord.aggregate([
      { $match: workedMatch },
      {
        $project: {
          berryTypeKey: { $trim: { input: { $toLower: { $ifNull: ['$berryType', 'unknown'] } } } },
          amount: 1,
          calculatedIncome: 1,
          date: 1,
          netKg: { $subtract: ['$berryWeightKg', '$carrotWeightKg'] },
        },
      },
      {
        $group: {
          _id: '$berryTypeKey',
          totalPaid: { $sum: '$calculatedIncome' },
          totalKg: { $sum: '$netKg' },
          recordCount: { $sum: 1 },
          sumOfRates: { $sum: '$amount' },
          minRate: { $min: '$amount' },
          maxRate: { $max: '$amount' },
          firstPickedDate: { $min: '$date' },
          lastPickedDate: { $max: '$date' },
        },
      },
      { $sort: { totalKg: -1 } },
    ]),
    IncomeRecord.countDocuments({ ...incomeMatch, berryWeightKg: 0 }),
    // For reconstructing the rate history per berry type: how many records used each
    // (berry type, date, rate) combination, so the most common rate per day can be picked.
    IncomeRecord.aggregate([
      { $match: workedMatch },
      {
        $project: {
          berryTypeKey: { $trim: { input: { $toLower: { $ifNull: ['$berryType', 'unknown'] } } } },
          date: 1,
          amount: 1,
        },
      },
      {
        $group: {
          _id: { berryTypeKey: '$berryTypeKey', date: '$date', amount: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const applicantIds = workingDaysByApplicant.map(entry => entry._id);

  // Expense records auto-generate lazily elsewhere in the app (e.g. when an admin opens an
  // applicant's detail page), so they may not all exist yet for every picker in this report's
  // range. Backfill them explicitly here so the expense totals below are complete and correct,
  // with bounded concurrency so this doesn't repeat the earlier outstanding-payments timeout bug.
  if (applicantIds.length && rangeEnd) {
    await runWithConcurrency(applicantIds, 10, applicantId => ensureExpenseRecordsForApplicant(applicantId, rangeEnd));
  }

  const expenseByApplicant = await ExpenseRecord.aggregate([
    { $match: incomeMatch },
    { $group: { _id: '$applicantId', expenseTotal: { $sum: '$calculatedExpense' } } },
  ]);

  const [applicants, userAccounts] = await Promise.all([
    applicantIds.length
      ? Applicant.find({ _id: { $in: applicantIds } }).select('_id fullName email groupName').lean()
      : [],
    applicantIds.length
      ? UserAccount.find({ applicantId: { $in: applicantIds } }).select('applicantId pickerId').lean()
      : [],
  ]);

  const applicantById = new Map(applicants.map(applicant => [String(applicant._id), applicant]));
  const pickerIdByApplicantId = new Map(userAccounts.map(account => [String(account.applicantId), account.pickerId || '']));
  const expenseByApplicantId = new Map(expenseByApplicant.map(entry => [String(entry._id), entry.expenseTotal || 0]));
  const fineByApplicantId = new Map(fineByApplicant.map(entry => [String(entry._id), entry.fineTotal || 0]));
  const grossByApplicantId = new Map(grossByApplicant.map(entry => [String(entry._id), entry.grossEarnings || 0]));
  const kgByApplicantId = new Map(kgByApplicant.map(entry => [String(entry._id), entry.kgPicked || 0]));
  const daysWorkedByApplicantId = new Map(workingDaysByApplicant.map(entry => [String(entry._id), entry.daysWorkedCount || 0]));

  const pickers = applicantIds.map(rawApplicantId => {
    const applicantId = String(rawApplicantId);
    const applicant = applicantById.get(applicantId);
    const grossEarnings = roundTo2(grossByApplicantId.get(applicantId) || 0);
    const expenseTotal = roundTo2(expenseByApplicantId.get(applicantId) || 0);
    const fineTotal = roundTo2(fineByApplicantId.get(applicantId) || 0);
    const netEarnings = roundTo2(grossEarnings - expenseTotal - fineTotal);
    const daysWorked = daysWorkedByApplicantId.get(applicantId) || 0;
    const netPerDay = daysWorked > 0 ? roundTo2(netEarnings / daysWorked) : 0;
    const kgPicked = roundTo2(kgByApplicantId.get(applicantId) || 0);
    const kgPickedPerDay = daysWorked > 0 ? roundTo2(kgPicked / daysWorked) : 0;

    return {
      applicantId,
      fullName: applicant?.fullName || 'Unknown picker',
      email: applicant?.email || '',
      groupName: applicant?.groupName || '',
      pickerId: pickerIdByApplicantId.get(applicantId) || '',
      daysWorked,
      grossEarnings,
      expenseTotal,
      fineTotal,
      netEarnings,
      netPerDay,
      kgPicked,
      kgPickedPerDay,
    };
  });

  pickers.sort((left, right) => right.netEarnings - left.netEarnings);

  const pickerCount = pickers.length;
  const grossValues = pickers.map(picker => picker.grossEarnings);
  const netValues = pickers.map(picker => picker.netEarnings);
  const netPerDayValues = pickers.map(picker => picker.netPerDay);
  const kgPickedPerDayValues = pickers.map(picker => picker.kgPickedPerDay);
  const totalDaysWorked = pickers.reduce((sum, picker) => sum + picker.daysWorked, 0);
  const totalGross = roundTo2(grossValues.reduce((sum, value) => sum + value, 0));
  const totalNet = roundTo2(netValues.reduce((sum, value) => sum + value, 0));
  const totalExpense = roundTo2(pickers.reduce((sum, picker) => sum + picker.expenseTotal, 0));
  const totalFine = roundTo2(pickers.reduce((sum, picker) => sum + picker.fineTotal, 0));

  // For each berry type, pick the most common rate per date (the "day rate"), then collapse
  // consecutive same-rate dates into ranges for display.
  const modeRateByTypeAndDate = new Map();
  for (const row of berryTypeDateRates) {
    const { berryTypeKey, date, amount } = row._id;
    const dateKey = new Date(date).getTime();

    if (!modeRateByTypeAndDate.has(berryTypeKey)) {
      modeRateByTypeAndDate.set(berryTypeKey, new Map());
    }

    const dateMap = modeRateByTypeAndDate.get(berryTypeKey);
    const existing = dateMap.get(dateKey);
    if (!existing || row.count > existing.count) {
      dateMap.set(dateKey, { date: new Date(date), amount, count: row.count });
    }
  }

  const berryTypeBreakdown = berryTypeAggregate.map(entry => {
    const totalKg = entry.totalKg || 0;
    const recordCount = entry.recordCount || 0;
    const dateMap = modeRateByTypeAndDate.get(entry._id);
    const priceRanges = dateMap ? buildPriceRanges(Array.from(dateMap.values())) : [];

    return {
      berryType: capitalizeLabel(entry._id),
      recordCount,
      totalKg: roundTo2(totalKg),
      totalPaid: roundTo2(entry.totalPaid || 0),
      weightedAveragePricePerKg: totalKg > 0 ? roundTo2((entry.totalPaid || 0) / totalKg) : 0,
      simpleAveragePricePerKg: recordCount > 0 ? roundTo2((entry.sumOfRates || 0) / recordCount) : 0,
      minPricePerKg: recordCount > 0 ? roundTo2(entry.minRate || 0) : 0,
      maxPricePerKg: recordCount > 0 ? roundTo2(entry.maxRate || 0) : 0,
      firstPickedDate: entry.firstPickedDate || null,
      lastPickedDate: entry.lastPickedDate || null,
      priceRanges,
    };
  });

  const totalBerryPickedKg = roundTo2(berryTypeBreakdown.reduce((sum, entry) => sum + entry.totalKg, 0));

  return {
    range: {
      fromDate: rangeStart,
      toDate: rangeEnd,
    },
    availableRange,
    pickerCount,
    totals: {
      grossEarnings: totalGross,
      netEarnings: totalNet,
      expenseTotal: totalExpense,
      fineTotal: totalFine,
      daysWorked: totalDaysWorked,
    },
    grossEarningsPerPicker: {
      averagePerPicker: roundTo2(average(grossValues)),
      min: grossValues.length ? roundTo2(Math.min(...grossValues)) : 0,
      max: grossValues.length ? roundTo2(Math.max(...grossValues)) : 0,
    },
    netEarningsPerPicker: {
      averagePerPicker: roundTo2(average(netValues)),
      min: netValues.length ? roundTo2(Math.min(...netValues)) : 0,
      max: netValues.length ? roundTo2(Math.max(...netValues)) : 0,
    },
    netEarningsPerPickerPerDay: {
      averageOfPerPickerDailyAverages: roundTo2(average(netPerDayValues)),
      aggregateWeightedAverage: totalDaysWorked > 0 ? roundTo2(totalNet / totalDaysWorked) : 0,
    },
    berryTypeBreakdown,
    totalBerryPickedKg,
    berryPickedPerPickerPerDay: {
      averageOfPerPickerDailyAverages: roundTo2(average(kgPickedPerDayValues)),
      aggregateWeightedAverage: totalDaysWorked > 0 ? roundTo2(totalBerryPickedKg / totalDaysWorked) : 0,
    },
    nonWorkingRecordCount,
    pickers,
  };
};
