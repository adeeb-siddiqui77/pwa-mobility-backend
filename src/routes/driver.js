import express from "express";
import { checkDriver, sendOtpByPhone, sendOtpByVehicleNo, verifyOtpForDriver, verifyOtpForMechanic, checkDriverByVehicle} from "../controllers/driverController.js";

const router = express.Router();

// Routes
router.get("/check-driver/:phone", checkDriver);
router.get("/check-driver/:vehicleNo", checkDriverByVehicle);
router.get("/send-otp-vehicle", sendOtpByVehicleNo);
router.post("/send-otp-phone", sendOtpByPhone);
router.get("/verify-otp-driver", verifyOtpForDriver);
router.get("/verify-otp-mechanic", verifyOtpForMechanic);

export default router;