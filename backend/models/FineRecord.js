import mongoose from 'mongoose';

const fineAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true, maxlength: 255, default: '' },
    mimeType: { type: String, trim: true, maxlength: 120, default: '' },
    size: { type: Number, min: 0, default: 0 },
    data: { type: Buffer, default: null },
  },
  { _id: false }
);

const fineRecordSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId },
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    date: { type: Date, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    sourceAmount: { type: Number, required: true, min: 0 },
    sourceVatPercent: { type: Number, required: true, min: 0 },
    sourceVatAmount: { type: Number, required: true, min: 0 },
    sourceNetAmount: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    vatPercent: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    allocationCount: { type: Number, required: true, min: 1 },
    allocationIndex: { type: Number, required: true, min: 1 },
    attachment: { type: fineAttachmentSchema, default: null },
    createdBy: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

fineRecordSchema.index({ applicantId: 1, date: -1 }, { background: true });
fineRecordSchema.index({ batchId: 1 }, { background: true });

const FineRecord = mongoose.model('FineRecord', fineRecordSchema);

export default FineRecord;