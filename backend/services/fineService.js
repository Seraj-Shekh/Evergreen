import mongoose from 'mongoose';
import FineRecord from '../models/FineRecord.js';

const toUtcDay = value => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const roundToTwo = value => Math.round((Number(value) || 0) * 100) / 100;

const extractAttachmentBuffer = rawData => {
  if (!rawData) {
    return null;
  }

  if (Buffer.isBuffer(rawData)) {
    return rawData;
  }

  if (rawData instanceof Uint8Array) {
    return Buffer.from(rawData);
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData);
  }

  if (rawData?.type === 'Buffer' && Array.isArray(rawData.data)) {
    return Buffer.from(rawData.data);
  }

  if (typeof rawData.value === 'function') {
    const value = rawData.value();
    if (Buffer.isBuffer(value)) {
      return value;
    }

    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }

    if (value?.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
  }

  if (rawData?.buffer) {
    if (Buffer.isBuffer(rawData.buffer)) {
      return rawData.buffer;
    }

    if (rawData.buffer instanceof Uint8Array) {
      return Buffer.from(rawData.buffer);
    }

    if (rawData.buffer?.type === 'Buffer' && Array.isArray(rawData.buffer.data)) {
      return Buffer.from(rawData.buffer.data);
    }
  }

  if (Array.isArray(rawData.data)) {
    return Buffer.from(rawData.data);
  }

  return null;
};

const splitMoneyEvenly = (value, count) => {
  const safeCount = Math.max(1, Number.parseInt(count, 10) || 1);
  const totalCents = Math.max(0, Math.round(roundToTwo(value) * 100));
  const baseCents = Math.floor(totalCents / safeCount);
  let remainder = totalCents - (baseCents * safeCount);

  return Array.from({ length: safeCount }, () => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }

    return cents / 100;
  });
};

const normalizeAttachment = attachment => {
  if (!attachment || !attachment.data) {
    return null;
  }

  const rawData = String(attachment.data || '').trim();
  const base64Data = rawData.includes('base64,') ? rawData.split('base64,').pop() : rawData;
  const buffer = Buffer.from(base64Data, 'base64');

  return {
    filename: String(attachment.filename || '').trim(),
    mimeType: String(attachment.mimeType || '').trim() || 'application/octet-stream',
    size: Number.isFinite(Number(attachment.size)) && Number(attachment.size) >= 0 ? Number(attachment.size) : buffer.length,
    data: buffer,
  };
};

export const serializeAttachment = attachment => {
  if (!attachment) {
    return null;
  }

  const buffer = extractAttachmentBuffer(attachment.data);

  return {
    filename: attachment.filename || '',
    mimeType: attachment.mimeType || 'application/octet-stream',
    size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : (buffer?.length || 0),
    data: buffer ? buffer.toString('base64') : '',
  };
};

export const getAttachmentBuffer = attachment => {
  if (!attachment) {
    return null;
  }

  const rawData = attachment.data;
  const buffer = extractAttachmentBuffer(rawData);

  if (buffer) {
    return buffer;
  }

  if (typeof rawData === 'string' && rawData.trim()) {
    return Buffer.from(rawData, 'base64');
  }

  return null;
};

export const serializeFineRecord = record => {
  if (!record) {
    return record;
  }

  return {
    ...record,
    attachment: serializeAttachment(record.attachment),
  };
};

export const serializeFineRecords = records => (Array.isArray(records) ? records.map(serializeFineRecord) : []);

export const createFineRecordsForApplicants = async ({ applicantIds, date, reason, amount, vatPercent, attachment, createdBy }) => {
  const nextApplicantIds = [...new Set((Array.isArray(applicantIds) ? applicantIds : []).map(value => String(value).trim()).filter(Boolean))];

  if (!nextApplicantIds.length) {
    throw new Error('At least one applicant is required');
  }

  if (nextApplicantIds.some(value => !mongoose.isValidObjectId(value))) {
    throw new Error('Valid applicant ids are required');
  }

  const normalizedDate = toUtcDay(date);
  if (!normalizedDate) {
    throw new Error('Valid date is required');
  }

  const nextReason = String(reason || '').trim();
  if (!nextReason) {
    throw new Error('Reason is required');
  }

  const baseAmount = Number(amount);
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const nextVatPercent = Number(vatPercent);
  if (!Number.isFinite(nextVatPercent) || nextVatPercent < 0) {
    throw new Error('VAT percentage must be a non-negative number');
  }

  const sourceAmount = roundToTwo(baseAmount);
  const sourceVatPercent = roundToTwo(nextVatPercent);
  const sourceVatAmount = roundToTwo((sourceAmount * sourceVatPercent) / 100);
  const sourceNetAmount = roundToTwo(sourceAmount + sourceVatAmount);

  const amountShares = splitMoneyEvenly(sourceAmount, nextApplicantIds.length);
  const vatShares = splitMoneyEvenly(sourceVatAmount, nextApplicantIds.length);
  const netShares = splitMoneyEvenly(sourceNetAmount, nextApplicantIds.length);
  const batchId = new mongoose.Types.ObjectId();
  const normalizedAttachment = normalizeAttachment(attachment);
  const nextCreatedBy = String(createdBy || '').trim();

  const records = nextApplicantIds.map((applicantId, index) => ({
    batchId,
    applicantId,
    date: normalizedDate,
    reason: nextReason,
    sourceAmount,
    sourceVatPercent,
    sourceVatAmount,
    sourceNetAmount,
    amount: amountShares[index],
    vatPercent: sourceVatPercent,
    vatAmount: vatShares[index],
    netAmount: netShares[index],
    allocationCount: nextApplicantIds.length,
    allocationIndex: index + 1,
    attachment: normalizedAttachment,
    createdBy: nextCreatedBy,
  }));

  const createdRecords = await FineRecord.insertMany(records);

  return {
    batchId,
    sourceAmount,
    sourceVatPercent,
    sourceVatAmount,
    sourceNetAmount,
    createdCount: createdRecords.length,
    createdRecords,
  };
};

export const getFineSummaryForApplicant = async ({ applicantId, fromDate, toDate } = {}) => {
  if (!mongoose.isValidObjectId(applicantId)) {
    throw new Error('Valid applicantId is required');
  }

  const filter = { applicantId: new mongoose.Types.ObjectId(applicantId) };

  if (fromDate || toDate) {
    filter.date = {};

    if (fromDate) {
      const start = toUtcDay(fromDate);
      if (!start) {
        throw new Error('Valid fromDate is required');
      }
      filter.date.$gte = start;
    }

    if (toDate) {
      const end = toUtcDay(toDate);
      if (!end) {
        throw new Error('Valid toDate is required');
      }
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const [fineRecords, fineAggregate] = await Promise.all([
    FineRecord.find(filter).sort({ date: -1, createdAt: -1 }).lean(),
    FineRecord.aggregate([
      { $match: filter },
      { $group: { _id: null, totalFine: { $sum: '$netAmount' }, totalSourceAmount: { $sum: '$sourceAmount' }, totalVatAmount: { $sum: '$sourceVatAmount' } } },
    ]),
  ]);

  return {
    fineRecords,
    fineTotal: roundToTwo(fineAggregate[0]?.totalFine || 0),
    sourceAmountTotal: roundToTwo(fineAggregate[0]?.totalSourceAmount || 0),
    vatAmountTotal: roundToTwo(fineAggregate[0]?.totalVatAmount || 0),
  };
};

export const listFineRecordsForAdmin = async ({ applicantId } = {}) => {
  const filter = {};

  if (applicantId) {
    if (!mongoose.isValidObjectId(applicantId)) {
      throw new Error('Valid applicantId is required');
    }

    filter.applicantId = new mongoose.Types.ObjectId(applicantId);
  }

  const fineRecords = await FineRecord.find(filter)
    .populate('applicantId', 'fullName email pickerId groupName')
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const totals = fineRecords.reduce((accumulator, record) => {
    accumulator.count += 1;
    accumulator.sourceAmount += roundToTwo(record.sourceAmount || 0);
    accumulator.sourceVatAmount += roundToTwo(record.sourceVatAmount || 0);
    accumulator.sourceNetAmount += roundToTwo(record.sourceNetAmount || 0);
    accumulator.netAmount += roundToTwo(record.netAmount || 0);
    return accumulator;
  }, { count: 0, sourceAmount: 0, sourceVatAmount: 0, sourceNetAmount: 0, netAmount: 0 });

  return {
    fineRecords,
    totals,
  };
};

export const updateFineRecordById = async ({ id, updates = {} }) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error('Valid fine record id is required');
  }

  const fineRecord = await FineRecord.findById(id);
  if (!fineRecord) {
    throw new Error('Fine record not found');
  }

  if (updates.date !== undefined) {
    const normalizedDate = toUtcDay(updates.date);
    if (!normalizedDate) {
      throw new Error('Valid date is required');
    }
    fineRecord.date = normalizedDate;
  }

  if (updates.reason !== undefined) {
    const nextReason = String(updates.reason || '').trim();
    if (!nextReason) {
      throw new Error('Reason is required');
    }
    fineRecord.reason = nextReason;
  }

  if (updates.amount !== undefined) {
    const nextAmount = Number(updates.amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      throw new Error('Amount must be a non-negative number');
    }
    fineRecord.amount = roundToTwo(nextAmount);
  }

  if (updates.vatPercent !== undefined) {
    const nextVatPercent = Number(updates.vatPercent);
    if (!Number.isFinite(nextVatPercent) || nextVatPercent < 0) {
      throw new Error('VAT percentage must be a non-negative number');
    }
    fineRecord.vatPercent = roundToTwo(nextVatPercent);
  }

  fineRecord.vatAmount = roundToTwo((Number(fineRecord.amount || 0) * Number(fineRecord.vatPercent || 0)) / 100);
  fineRecord.netAmount = roundToTwo(Number(fineRecord.amount || 0) + Number(fineRecord.vatAmount || 0));

  if (updates.attachment !== undefined) {
    fineRecord.attachment = normalizeAttachment(updates.attachment);
  }

  if (updates.createdBy !== undefined) {
    fineRecord.createdBy = String(updates.createdBy || '').trim();
  }

  await fineRecord.save();
  return fineRecord.toObject();
};

export const deleteFineRecordById = async id => {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error('Valid fine record id is required');
  }

  const result = await FineRecord.deleteOne({ _id: id });
  return result.deletedCount || 0;
};