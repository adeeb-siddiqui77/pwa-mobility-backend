import mongoose from 'mongoose';

const rateCardSchema = new mongoose.Schema({
    tyreService: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    unit : {
        type : String,
        required : true
    },
    normalRate : {
        type : Number
    },
    tubelessRate : {
        type : Number
    }
}, { timestamps: true });



const RateCard = mongoose.model('RateCard', rateCardSchema);

export default RateCard;