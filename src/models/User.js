import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    pin: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    shopName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    businessDays: [
        {
            type: String
        }
    ],
    timeFrom: {
        type: String,
        required: true
    },
    timeTo: {
        type: String,
        required: true
    },
    upi: {
        type: String,
        required: true
    },
    // Adding file upload fields
    adharCard: {
        type: String, // This will store the file path or URL
        required: true
    },
    loiForm: {
        type: String,
        required: true
    },
    kycImage: {
        type: String,
        required: true
    },
    qrCode: {
        type: String,
        required: true
    },
    isFirstLogin: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Pre-save hook to hash the PIN
userSchema.pre('save', async function (next) {
    if (!this.isModified('pin')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.pin = await bcrypt.hash(this.pin, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare PIN
userSchema.methods.comparePin = async function (candidatePin) {
    return await bcrypt.compare(candidatePin, this.pin);
};

const User = mongoose.model('User', userSchema);

export default User;