import mongoose from 'mongoose';

const paymentRecordSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    fromDate: { type: Date, required: true, index: true },
    toDate: { type: Date, required: true, index: true },
    incomeTotal: { type: Number, required: true, min: 0 },
    expenseTotal: { type: Number, required: true, min: 0 },
    netPayable: { type: Number, required: true },
    paidAmount: { type: Number, required: true },
    currency: { type: String, trim: true, maxlength: 8, default: 'EUR' },
    paidAt: { type: Date, required: true, default: Date.now, index: true },
    paidBy: { type: String, trim: true, maxlength: 120, default: '' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['paid'], default: 'paid' },
  },
  { timestamps: true }
);

paymentRecordSchema.index({ applicantId: 1, fromDate: 1, toDate: 1 }, { unique: true, background: true });

const PaymentRecord = mongoose.model('PaymentRecord', paymentRecordSchema);

export default PaymentRecord;