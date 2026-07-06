import mongoose from 'mongoose';

const expensePlanSchema = new mongoose.Schema(
  {
    scopeType: { type: String, enum: ['group', 'applicant'], required: true, index: true },
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', default: null, index: true },
    groupName: { type: String, trim: true, maxlength: 64, default: '', index: true },
    expenseType: { type: String, enum: ['own-car', 'rented-car'], required: true },
    dailyAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, maxlength: 8, default: 'EUR' },
    startsOn: { type: Date, required: true, index: true },
    endsOn: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

expensePlanSchema.index({ scopeType: 1, applicantId: 1, startsOn: -1 }, { background: true });
expensePlanSchema.index({ scopeType: 1, groupName: 1, startsOn: -1 }, { background: true });

const ExpensePlan = mongoose.model('ExpensePlan', expensePlanSchema);

export default ExpensePlan;