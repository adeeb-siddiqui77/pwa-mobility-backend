
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import RateCard from '../models/RateCard.js';

const router = Router();

// Environment variables (should be in .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Admin login route
router.post('/admin/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('pin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('PIN must be 4-6 digits')
], handleValidationErrors, async (req, res) => {
  try {
    const { email, pin } = req.body;
    
    // Find admin by email
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    // Compare PIN
    const isPinValid = await admin.comparePin(pin);
    
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1d' } // Shorter expiry for admin tokens
    );
    
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
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
});

// User login with PIN
router.post('/user/login', [
  body('mobile').isMobilePhone().withMessage('Valid mobile number is required'),
  body('pin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('PIN must be 4-6 digits')
], handleValidationErrors, async (req, res) => {
  try {
    const { mobile, pin } = req.body;
    
    // Find user by mobile
    const user = await User.findOne({ mobile });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Compare PIN
    const isPinValid = await user.comparePin(pin);
    
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, mobile, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        mobile: user.mobile,
        fullName: user.fullName,
        shopName: user.shopName,
        address: user.address,
        isFirstLogin: user.isFirstLogin
      }
    });
  } catch (error) {
    console.error('User login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Create user route (admin only) with file uploads
router.post('/user/create', 
  protect, 
  adminOnly,
  upload.fields([
    { name: 'adharCard', maxCount: 1 },
    { name: 'loiForm', maxCount: 1 },
    { name: 'kycImage', maxCount: 1 },
    { name: 'qrCode', maxCount: 1 }
  ]),
  [
    body('mobile').isMobilePhone().withMessage('Valid mobile number is required'),
    body('pin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('PIN must be 4-6 digits'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('shopName').notEmpty().withMessage('Shop name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('businessDays').isArray().withMessage('Business days must be an array'),
    body('timeFrom').notEmpty().withMessage('Opening time is required'),
    body('timeTo').notEmpty().withMessage('Closing time is required'),
    body('upi').notEmpty().withMessage('UPI ID is required')
  ], 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const { 
        mobile, 
        pin, 
        fullName, 
        shopName, 
        address, 
        businessDays, 
        timeFrom, 
        timeTo, 
        upi 
      } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ mobile });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this mobile number already exists'
        });
      }
      
      // Check if all required files are uploaded
      if (!req.files || !req.files.adharCard || !req.files.loiForm || !req.files.kycImage || !req.files.qrCode) {
        return res.status(400).json({
          success: false,
          message: 'All required files (adharCard, loiForm, kycImage, qrCode) must be uploaded'
        });
      }
      
      // Create new user with file paths
      const newUser = new User({
        mobile,
        pin,
        fullName,
        shopName,
        address,
        businessDays: Array.isArray(businessDays) ? businessDays : [businessDays],
        timeFrom,
        timeTo,
        upi,
        adharCard: req.files.adharCard[0].path,
        loiForm: req.files.loiForm[0].path,
        kycImage: req.files.kycImage[0].path,
        qrCode: req.files.qrCode[0].path,
        isFirstLogin: true,
        createdBy: req.user._id
      });
      
      await newUser.save();
      
      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser._id,
          mobile: newUser.mobile,
          fullName: newUser.fullName,
          shopName: newUser.shopName,
          isFirstLogin: newUser.isFirstLogin
        }
      });
    } catch (error) {
      console.error('Create user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }
);

// Change PIN route (for users after first login)
router.post('/user/change-pin', [
  body('currentPin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('Current PIN must be 4-6 digits'),
  body('newPin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('New PIN must be 4-6 digits')
], handleValidationErrors, protect, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    
    // Only allow user role to change PIN
    if (req.user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only users can change their PIN'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify current PIN
    const isPinValid = await user.comparePin(currentPin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Current PIN is incorrect'
      });
    }
    
    // Hash the new PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin, salt);
    
    // Update PIN using findByIdAndUpdate to avoid validation
    await User.findByIdAndUpdate(
      req.user._id,
      { 
        pin: hashedPin,
        isFirstLogin: false
      },
      { 
        new: true,
        runValidators: false // This prevents validation of other required fields
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'PIN changed successfully'
    });
  } catch (error) {
    console.error('Change PIN error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change PIN'
    });
  }
});

// Reset user PIN (admin only)
router.post('/user/reset-pin', [
  body('mobile').isMobilePhone().withMessage('Valid mobile number is required'),
  body('newPin').isLength({ min: 4, max: 6 }).isNumeric().withMessage('New PIN must be 4-6 digits')
], handleValidationErrors, protect, adminOnly, async (req, res) => {
  try {
    const { mobile, newPin } = req.body;
    
    // Find user by mobile
    const user = await User.findOne({ mobile });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Hash the new PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin, salt);
    
    // Reset PIN using findByIdAndUpdate to avoid validation
    await User.findByIdAndUpdate(
      user._id,
      { 
        pin: hashedPin,
        isFirstLogin: true
      },
      { 
        new: true,
        runValidators: false // This prevents validation of other required fields
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'User PIN reset successfully'
    });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset PIN'
    });
  }
});

// Get user profile
router.get('/user/profile', protect, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const user = await User.findById(req.user._id).select('-pin');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Get all users (admin only)
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-pin').sort('-createdAt');
    
    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
});


// rate Card

router.post('/rateCard/create' , protect , adminOnly ,async(req,res)=>{
  try {
    const { tyreService, unit , normalRate , tubelessRate } = req.body;
    
    const newRateCard= new RateCard({
      tyreService , unit , normalRate, tubelessRate
    })
    
    return res.status(200).json({
      success: true,
      message: 'User PIN reset successfully'
    });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset PIN'
    });
  }
})

export default router;
