import mongoose from 'mongoose';

const applicantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 32 },
    hasDrivingLicense: { type: Boolean, required: true },
    hasOwnCar: { type: Boolean, required: true },
    carPlateNumber: { type: String, trim: true, maxlength: 32, default: '' },
    additionalDescription: { type: String, trim: true, maxlength: 2000, default: '' },
    acceptedTerms: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ['pending', 'reviewed', 'selected', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

// ensure a unique index on email for duplicate protection
applicantSchema.index({ email: 1 }, { unique: true, background: true });
applicantSchema.index({ createdAt: -1 });

const Applicant = mongoose.model('Applicant', applicantSchema);

export default Applicant;
