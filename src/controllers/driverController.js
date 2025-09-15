import Driver from "../models/Driver.js";
import { sendSms, sendWhatsAppMessage } from "../services/otpService.js";
import crypto from "crypto";

// 1️⃣ Check driver exists by phone number
export const checkDriver = async (req, res) => {
  try {
    const { phone } = req.params;
    console.log("phone", phone);
    const driver = await Driver.findOne({ driverPhone: phone });
    return res.json({ 
      exists: !!driver,
      vehicleNo : driver ? driver.vehicleNo : null,
      name : driver ? driver.driverName : null,
     });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// 2️⃣ Send OTP using vehicle number
export const sendOtpByVehicleNo = async (req, res) => {
  try {
    const { vehicleNo } = req.query;
    console.log("vehicleNo", vehicleNo);
    const driver = await Driver.findOne({ vehicleNo });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Generate 6 digit OTP
    const otpValue = crypto.randomInt(100000, 999999).toString();
    await Driver.updateOne(
      { _id: driver._id },
      { $set: { otp: otpValue } }
    );

    // Send SMS
    await sendSms(driver.driverPhone, otpValue);
    // await sendSms("9058007777", otpValue);

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};


export const sendOtpByPhone = async (req, res) => {
  try {
    const { phone, services} = req.body;
    const driver = await Driver.findOne({ driverPhone: phone });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Generate 6 digit OTP
   
    const otpValue = crypto.randomInt(1000, 10000).toString()

    await Driver.updateOne(
      { _id: driver._id },
      { $set: { otp: otpValue } }
    );

    // Send SMS
    await sendWhatsAppMessage(phone, `Your Happy Code is ${otpValue}`);
    // await sendSms("9058007777", otpValue);

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// 3️⃣ Verify OTP
export const verifyOtpForDriver = async (req, res) => {
  try {
    const { vehicleNo, otp } = req.query;
    console.log("vehicleNo", vehicleNo, otp);
    const driver = await Driver.findOne({ vehicleNo });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Validate OTP
    const isValid = driver.otp === otp;

    if (isValid) {
      // clear OTP after success
      await Driver.updateOne(
      { _id: driver._id },
      { $set: { otp: null } }
    );
    }
    return res.json({ valid: isValid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

export const verifyOtpForMechanic = async (req, res) => {
  try {
    const { phoneNo, otp } = req.query;
    const driver = await Driver.findOne({ driverPhone: phoneNo });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Validate OTP
    const isValid = driver.otp === otp;

    if (isValid) {
      // clear OTP after success
      await Driver.updateOne(
      { _id: driver._id },
      { $set: { otp: null } }
    );
    }
    return res.json({ valid: isValid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
