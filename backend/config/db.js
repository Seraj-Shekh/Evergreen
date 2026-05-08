import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME;

  if (!mongoUrl) {
    throw new Error('MONGO_URL is not defined');
  }

  await mongoose.connect(mongoUrl, dbName ? { dbName } : undefined);
  console.log('MongoDB connected');
};

export default connectDB;
