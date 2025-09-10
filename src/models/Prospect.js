
import mongoose from 'mongoose'

const FileSchema = new mongoose.Schema({
  field: String,
  originalName: String,
  fileName: String,
  mimeType: String,
  size: Number,
  url: String
}, { _id:false })

const ProspectSchema = new mongoose.Schema({
  mobile: String,
  fullName: String,
  shopName: String,
  address: String,
  upi: String,
  files: [FileSchema],
  paymentLink: String
}, { timestamps: true })

export default mongoose.model('Prospect', ProspectSchema)
