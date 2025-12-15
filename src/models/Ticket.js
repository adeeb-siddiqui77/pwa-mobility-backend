import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
    zohoTicketId: {
        type: String,
        required: true,
        unique: true
    },
    mechanicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: true
    },
    entitySkills: [String],
    subCategory: String,
    cf: Object,
    productId: String,
    contactId: String,
    subject: String,
    dueDate: Date,
    departmentId: String,
    channel: String,
    description: String,
    language: String,
    priority: String,
    classification: String,
    assigneeId: String,
    phone: String,
    category: String,
    email: String,
    status: String,
    preRepairPhotos : [
        {
            type : String
        }
    ],
    postRepairPhotos : [
        {
            type : String
        }
    ],
    workDetails : {
        tyreType : {type : String},
        services : [{type : String}],
        patchType : {type : String},
        patchNumber : {type : String},
        otherServices : {type : String}
    },
    images : [
        {
            type : String
        }
    ],
   
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('Ticket', ticketSchema);
