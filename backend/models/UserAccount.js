import mongoose from 'mongoose';

const userAccountSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    pickerId: { type: String, trim: true, maxlength: 32, unique: true, sparse: true, index: true },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    resetPasswordTokenHash: { type: String, default: '' },
    resetPasswordExpiresAt: { type: Date },
    bankName: { type: String, trim: true, maxlength: 120, default: '' },
    bankAccountNumber: { type: String, trim: true, maxlength: 64, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userAccountSchema.index({ email: 1 }, { unique: true, background: true });
userAccountSchema.index({ pickerId: 1 }, { unique: true, background: true, sparse: true });

const UserAccount = mongoose.model('UserAccount', userAccountSchema);

export default UserAccount;
