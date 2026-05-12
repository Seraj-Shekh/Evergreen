import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import Applicant from '../models/Applicant.js';
import UserAccount from '../models/UserAccount.js';

dotenv.config();

const parseArg = (name) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
};

const email = (parseArg('--email') || '').trim().toLowerCase();
const password = parseArg('--password');
const force = process.argv.includes('--force');

if (!email || !password) {
  console.error('Usage: node scripts/createUserAccount.js --email user@example.com --password TempPass123! [--force]');
  process.exit(1);
}

const run = async () => {
  await connectDB();

  const applicant = await Applicant.findOne({ email }).lean();

  if (!applicant) {
    console.error(`No applicant found with email ${email}`);
    process.exit(1);
  }

  const existing = await UserAccount.findOne({ email });
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (!force) {
      console.error('User account already exists. Re-run with --force to reset password.');
      process.exit(1);
    }

    existing.passwordHash = passwordHash;
    existing.mustChangePassword = true;
    existing.applicantId = applicant._id;
    existing.fullName = applicant.fullName;
    await existing.save();

    console.log('Existing user account updated and marked to change password.');
    process.exit(0);
  }

  await UserAccount.create({
    applicantId: applicant._id,
    fullName: applicant.fullName,
    email: applicant.email,
    passwordHash,
    mustChangePassword: true,
  });

  console.log('User account created and marked to change password.');
  process.exit(0);
};

run().catch(error => {
  console.error(error);
  mongoose.connection.close();
  process.exit(1);
});
