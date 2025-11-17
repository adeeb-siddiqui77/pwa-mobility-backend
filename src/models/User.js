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
    },
    fullName: {
        type: String,
    },
    shopName: {
        type: String,
    },
    address: {
        type: String,
    },
    businessDays: [
        {
            type: String
        }
    ],
    timeFrom: {
        type: String,
    },
    timeTo: {
        type: String,
    },
    upi: {
        type: String,
    },
    // Adding file upload fields
    adharCard: {
        type: String, // This will store the file path or URL

    },
    loiForm: {
        type: String
    },
    kycImage: {
        type: String
    },
    qrCode: {
        type: String
    },
    isFirstLogin: {
        type: Boolean,
        default: true
    },
    fraudStatus: {
        type: String,
        enum: ["none", "fraud", "under_review"],
        default: "none"
    },
    fraudNote: { type: String },
    fraudUpdatedAt: { type: Date },



    // Extra fields from Excel, all optional
    dateOfOnboarding: { type: Date, required: false },
    jkmfClosedInActiveDate: { type: Date, required: false },
    jkmfRegNoNew: { type: String, required: false },
    jkmfUniqueName: { type: String, required: false },
    location: { type: String, required: false },
    jkmfInHubHighway: { type: String, required: false },
    dedicatedToWhichFleet: { type: String, required: false },
    loiAvailable: { type: Boolean, required: false },
    status: { type: String, required: false },
    inActiveReason: { type: String, required: false },
    zone: { type: String, required: false },
    zonalCoordinator: { type: String, required: false },
    ownerName: { type: String, required: false },
    primaryContactNo: { type: String, required: false },
    secondaryContactNo: { type: String, required: false },
    postalAddress: { type: String, required: false },
    pinCode: { type: String, required: false },
    state: { type: String, required: false },
    district: { type: String, required: false },
    googleMapsLocation: { type: String, required: false },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            required: false
        }
    },
    recommendedBy: { type: String, required: false },
    lastVehicleAttendedOn: { type: Date, required: false },
    servicesFirstSep23Today: { type: Number, required: false },
    bdsAttendedByHDTill30Apr24: { type: Number, required: false },
    bdsAttendedByHDTill30Apr24_31Oct24: { type: Number, required: false },
    servicesTill31Aug23: { type: Number, required: false },
    attendedByHDTill31May25From1Nov24: { type: Number, required: false },
    totalServices: { type: Number, required: false },
    callingStatusAsOnAug23: { type: String, required: false },
    callingRemarks: { type: String, required: false },
    capableForTLTyre: { type: Boolean, required: false },
    haveSpecificTools: { type: Boolean, required: false },
    tShirtSize: { type: String, required: false },
    shoeSize: { type: String, required: false },
    shopCategory: { type: String, required: false },
    panCard: { type: String, required: false },
    aadharCardNumber: { type: String, required: false },
    nameAsPerBank: { type: String, required: false },
    bankName: { type: String, required: false },
    bankAccountNumber: { type: String, required: false },
    ifscCode: { type: String, required: false },
    accountStatus: { type: String, required: false },
    eligibilityFor1stReward: { type: Boolean, required: false },
    firstRewardStatus: { type: String, required: false },
    newRewardsStatus: { type: String, required: false },
    billBookStatus: { type: String, required: false },
    firstRewardDeliveryDate: { type: Date, required: false },
    rewardCycle: { type: String, required: false },
    eligibilityFor2ndReward: { type: Boolean, required: false },
    certificate: { type: String, required: false },
    secondRewardStatus: { type: String, required: false },
    secondRewardDeliveryDate: { type: Date, required: false },
    secondRewardCycle: { type: String, required: false },
    eligibilityFor3rdReward: { type: Boolean, required: false },
    thirdRewardStatus: { type: String, required: false },
    thirdRewardDeliveryDate: { type: Date, required: false },
    thirdRewardCycle: { type: String, required: false },
    eligibilityFor4thReward: { type: Boolean, required: false },
    eligibilityFor5thReward: { type: Boolean, required: false },
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