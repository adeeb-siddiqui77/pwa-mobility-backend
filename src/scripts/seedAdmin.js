import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create admin account
const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'adeeb@gmail.com' });
    
    if (existingAdmin) {
      console.log('Admin already exists');
      return;
    }
    
    // Create new admin
    const admin = new Admin({
      email: 'adeeb@gmail.com',
      pin: '123456'
    });
    
    await admin.save();
    console.log('Admin account created successfully');
  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the seed function
connectDB().then(() => {
  seedAdmin();
});