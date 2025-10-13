import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    vehicleNo: {
      type: String,
      required: true,
      trim: true,
    },
    driverName: {
      type: String,
      required: true,
      trim: true,
    },
    driverPhone: {
      type: String, // storing as string to avoid issues with leading zeros
      required: true,
    },
    fleetName : {
      type : String,
      required : true,
    },
    language : {
      type : String,
      default : "",
    },
    otp: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);
