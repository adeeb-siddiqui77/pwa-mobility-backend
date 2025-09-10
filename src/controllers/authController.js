import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

// Admin login
export const adminLogin = async (req, res) => {
  try {
    const { email, pin } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if PIN is correct
    const isPinValid = await admin.comparePin(pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // Generate token
    const token = generateToken(admin._id, 'admin');

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin login failed'
    });
  }
};

// User login
export const userLogin = async (req, res) => {
  try {
    const { mobile, pin } = req.body;

    // Check if user exists
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if PIN is correct
    const isPinValid = await user.comparePin(pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'User login successful',
      token,
      user: {
        id: user._id,
        mobile: user.mobile,
        role: user.role
      }
    });
  } catch (error) {
    console.error('User login error:', error);
    return res.status(500).json({
      success: false,
      message: 'User login failed'
    });
  }
};

// Create user (admin only)
export const createUser = async (req, res) => {
  try {
    const { mobile, pin } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this mobile number already exists'
      });
    }

    // Create new user
    const newUser = new User({
      mobile,
      pin,
      role: 'user'
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id,
        mobile: newUser.mobile,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

// Reset user PIN
export const resetUserPin = async (req, res) => {
  try {
    const { mobile, newPin } = req.body;

    // Check if user exists
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update PIN
    user.pin = newPin;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'PIN reset successfully'
    });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset PIN'
    });
  }
};