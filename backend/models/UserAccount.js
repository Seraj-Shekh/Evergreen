import mongoose from 'mongoose';

const userAccountSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userAccountSchema.index({ email: 1 }, { unique: true, background: true });

const UserAccount = mongoose.model('UserAccount', userAccountSchema);

export default UserAccount;
