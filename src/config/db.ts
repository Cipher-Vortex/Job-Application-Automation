import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jobpilot';

export const connectDB = async () => {
  // Let's print exactly what Render is passing down (hiding the password for safety) 
  const safeLog = MONGODB_URI.substring(0, 30) + "...";
  console.log(`[DEBUG] Connecting to MongoDB using URI: "${safeLog}"`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
 