import mongoose from 'mongoose';

const expenseRecordSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    date: { type: Date, required: true, index: true },
    groupName: { type: String, trim: true, maxlength: 64, default: '' },
    scopeType: { type: String, enum: ['group', 'applicant'], required: true },
    expenseType: { type: String, enum: ['own-car', 'rented-car'], required: true },
    dailyAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, maxlength: 8, default: 'EUR' },
    calculatedExpense: { type: Number, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpensePlan', default: null, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

expenseRecordSchema.index({ applicantId: 1, date: 1 }, { unique: true, background: true });

const ExpenseRecord = mongoose.model('ExpenseRecord', expenseRecordSchema);

export default ExpenseRecord;