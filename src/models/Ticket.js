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
        required: true
    },
    // Zoho ticket fields
    entitySkills: [String],
    subCategory: String,
    cf: {
        cf_permanentaddress: String,
        cf_dateofpurchase: Date,
        cf_phone: String,
        cf_numberofitems: String,
        cf_url: String,
        cf_secondaryemail: String,
        cf_severitypercentage: String,
        cf_modelname: String
    },
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
    // Additional custom fields for our system
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
