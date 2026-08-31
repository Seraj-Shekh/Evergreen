import mongoose from 'mongoose';

const incomeRecordSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    date: { type: Date, required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    berryType: { type: String, required: true, trim: true, maxlength: 64 },
    berryWeightKg: { type: Number, required: true, min: 0 },
    carrotWeightKg: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    // calculated income: (berryWeightKg - carrotWeightKg) * amount
    calculatedIncome: { type: Number, required: true },
  },
  { timestamps: true }
);

// Not unique: a picker can have multiple records on the same day (e.g. different berry types).
incomeRecordSchema.index({ applicantId: 1, date: 1 }, { background: true });

const IncomeRecord = mongoose.model('IncomeRecord', incomeRecordSchema);

export default IncomeRecord;
