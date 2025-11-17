import mongoose from "mongoose";
import JobHistory from "../models/JobHistory.js";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";       // ADD THIS
import { updateZohoTicketStatusFraudRule } from "./zohoService.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function checkFraudAndProcess({
    mechanicId,
    driverPhone,
    regNumber,
    billAmount,
    startJobTime,
    endJobTime,
    ticketId,
    data,
    metadata = {}
}) {
    if (!mechanicId) throw new Error("mechanicId required");
    if (!ticketId) throw new Error("ticketId required");

    const mechId = new mongoose.Types.ObjectId(mechanicId);

    const mechanic = await User.findById(mechId);
    if (!mechanic) throw new Error("Mechanic not found");

    const now = new Date();

    console.log("mechanic verified , going for fraud check")


    console.log("data in fraud detection" , data)

    // return null;

    // ---------------------------------------------------------
    // 0️⃣ FAST-PATH CHECK → mechanic already fraud
    // ---------------------------------------------------------
    if (mechanic.fraudStatus === "fraud") {
        const zohoStatus = "Manual Approval";
        const fraudType = "MECHANIC_FLAGGED";


        // cf_fraud_type


        // update zoho and db
        const zohoResp = await updateZohoTicketStatusFraudRule(ticketId, zohoStatus, data, fraudType);

        await JobHistory.create({
            mechanicId: mechId,
            driverPhone,
            regNumber,
            billAmount,
            startJobTime,
            endJobTime,
            ticketId,
            metadata: {
                forcedFraud: true,
                fraudType,
                reason: "Mechanic already marked as fraud",
                zohoResp
            }
        });

        return {
            fraud: true,
            fraudType,
            zohoStatus,
            message: "Mechanic already marked as FRAUD. Auto-applying Manual Approval."
        };
    }

    // ---------------------------------------------------------
    // RULE 1 — Driver visits same mechanic ≥ 3 times in 30 days
    // ---------------------------------------------------------
    const since30 = new Date(now - 30 * MS_PER_DAY);
    const driverCount = driverPhone
        ? await JobHistory.countDocuments({
            mechanicId: mechId,
            driverPhone: new RegExp(driverPhone + "$"),
            createdAt: { $gte: since30 }
        })
        : 0;

    if (driverCount >= 2) {
        const fraudType = "DRIVER_MECHANIC";
        const message = `Driver ${driverPhone} visited mechanic ${mechanicId} ${driverCount + 1} times in 30 days.`;

        const zohoStatus = "Manual Approval";
        const zohoResp = await updateZohoTicketStatusFraudRule(ticketId, zohoStatus, data, fraudType);


        console.log("zohoResp" , zohoResp)


        // 💥 MARK MECHANIC AS FRAUD
        await User.findByIdAndUpdate(mechanicId, {
            fraudStatus: "fraud",
            fraudNote: message,
            fraudUpdatedAt: new Date()
        });

        const saved = await JobHistory.create({
            mechanicId: mechId,
            driverPhone,
            regNumber,
            billAmount,
            startJobTime,
            endJobTime,
            ticketId,
            metadata: { fraudDetected: true, fraudType, zohoResp }
        });

        return {
            fraud: true,
            fraudType,
            zohoStatus,
            message,
            savedId: saved._id
        };
    }

    // ---------------------------------------------------------
    // RULE 2 — Vehicle visits same mechanic ≥ 4 times in 90 days
    // ---------------------------------------------------------
    const since90 = new Date(now - 90 * MS_PER_DAY);
    const vehicleCount = regNumber
        ? await JobHistory.countDocuments({
            mechanicId: mechId,
            regNumber: new RegExp(regNumber, "i"),
            createdAt: { $gte: since90 }
        })
        : 0;

    if (vehicleCount >= 3) {
        const fraudType = "VEHICLE_MECHANIC";
        const message = `Vehicle ${regNumber} visited mechanic ${mechanicId} ${vehicleCount + 1} times in 90 days.`;

        const zohoStatus = "Manual Approval";
        const zohoResp = await updateZohoTicketStatusFraudRule(ticketId, zohoStatus, data, fraudType);

        // const localResp = await updateLocalTicket(ticketId, zohoStatus, true, fraudType, { zohoResp });

        // 💥 MARK MECHANIC AS FRAUD
        await User.findByIdAndUpdate(mechanicId, {
            fraudStatus: "fraud",
            fraudNote: message,
            fraudUpdatedAt: new Date()
        });

        const saved = await JobHistory.create({
            mechanicId: mechId,
            driverPhone,
            regNumber,
            billAmount,
            startJobTime,
            endJobTime,
            ticketId,
            metadata: { fraudDetected: true, fraudType, zohoResp }
        });

        return {
            fraud: true,
            fraudType,
            zohoStatus,
            message,
            savedId: saved._id
        };
    }

    // ---------------------------------------------------------
    // RULE 3 — BILL AMOUNT CHECK
    // ---------------------------------------------------------
    const billThreshold = 300;
    const isHighBill = (billAmount || 0) > billThreshold;
    const fraudType = isHighBill ? "BILL_HIGH" : "NONE";
    const zohoStatus = isHighBill ? "Manual Approval" : "Payment Processing";

    const zohoResp = await updateZohoTicketStatusFraudRule(ticketId, zohoStatus, data, fraudType);

    //   await updateLocalTicket(ticketId, zohoStatus, isHighBill, fraudType);

    await JobHistory.create({
        mechanicId: mechId,
        driverPhone,
        regNumber,
        billAmount,
        startJobTime,
        endJobTime,
        ticketId,
        metadata: { fraudDetected: isHighBill, fraudType, zohoResp }
    });

    return {
        fraud: isHighBill,
        fraudType,
        zohoStatus
    };
}
