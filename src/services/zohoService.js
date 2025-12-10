// src/services/zohoService.js
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js'
import Ticket from '../models/Ticket.js';
import { generateAccessToken, getValidAccessToken } from './tokenService.js';


import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




export async function createZohoTicketForMechanic(ticketData, mechanicId) {

  if (!mechanicId) throw new Error('mechanicId required');

  // ensure ObjectId
  let mechanicObjectId;
  try {
    mechanicObjectId = typeof mechanicId === 'string' ? new mongoose.Types.ObjectId(mechanicId) : mechanicId;
  } catch (err) {
    throw new Error('Invalid mechanicId');
  }

  // Find mechanic
  const mechanic = await User.findOne({ _id: mechanicObjectId });
  if (!mechanic) {
    const e = new Error('Mechanic not found');
    e.status = 404;
    throw e;
  }

  const multipleIssue = ticketData.cf.cf_issue
    .split(";")
    .map(issue => issue.trim())
    .filter(Boolean); // remove any empty strings


  multipleIssue.forEach((issue, index) => {
    ticketData.cf[`cf_issue${index + 1}`] = issue;
  });

  ticketData.cf.cf_pitstop_name = mechanic?.shopName;
  ticketData.cf.cf_pitstop_contact = mechanic?.mobile;
  ticketData.cf.cf_pitstop_location = mechanic?.address;


  const tokenDetails = await getValidAccessToken({ accessToken: null, expiresAt: null });
  if (!tokenDetails || !tokenDetails.accessToken) {
    throw new Error('Zoho access token not available');
  }

  // console.log("Access Token:", tokenDetails);


  const zohoTicketData = { ...ticketData };


  console.log("Creating Zoho ticket with data:", zohoTicketData);

  // Call Zoho
  const config = {
    method: 'post',
    url: 'https://desk.zoho.in/api/v1/tickets',
    headers: {
      'orgId': process.env.ZOHO_ORG_ID,
      'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
      'Content-Type': 'application/json'
    },
    data: zohoTicketData
  };

  // Create ticket in Zoho
  const zohoResponse = await axios(config);
  const zohoTicket = zohoResponse.data;


  // console.log("Zoho ticket:", zohoTicket);

  // Create replica in MongoDB
  const mongoTicket = await Ticket.create({
    zohoTicketId: zohoTicket.id,
    mechanicId: mechanicId,
    ...zohoTicket
  });

  console.log("Ticket created in Zoho and MongoDB:", { mongoTicket });


  return { zohoTicket, mongoTicket };
}


// Update Zoho Ticket status via fraud verification

// export const updateZohoTicketStatusFraudRule = async (ticketId, zohoStatus, data, fraudType) => {


//   console.log(ticketId, zohoStatus, data, fraudType)

//   console.log("data", data)
//   try {
//     if (!ticketId) {
//       throw {
//         status: 400,
//         message: 'Ticket ID is required'
//       };
//     }

//     if (!data || Object.keys(data).length === 0) {
//       throw {
//         status: 400,
//         message: 'No data provided'
//       };
//     }

//     data.cf.cf_fraud_type = fraudType;
//     data.status = zohoStatus;

//     // Generate Zoho token
//     const tokenDetails = await generateAccessToken({
//       accessToken: null,
//       expiresAt: null
//     });

//     console.log("Valid access token:", tokenDetails.accessToken);
//     console.log("Data:", data);


//     // Send update to Zoho
//     const config = {
//       method: 'patch',
//       url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
//       headers: {
//         'orgId': process.env.ZOHO_ORG_ID,
//         'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
//         'Content-Type': 'application/json'
//       },
//       data
//     };

//     const zohoResponse = await axios(config);
//     console.log("Zoho update response:", zohoResponse.data);

//     // Update MongoDB
//     const updatedMongoTicket = await Ticket.findOneAndUpdate(
//       { zohoTicketId: ticketId },
//       {
//         $set: {
//           ...data,
//           updatedAt: new Date()
//         }
//       },
//       { new: true }
//     );

//     if (!updatedMongoTicket) {
//       throw {
//         status: 404,
//         message: 'Ticket updated in Zoho but not found in local database'
//       };
//     }

//     return {
//       success: true,
//       data: updatedMongoTicket,
//       zoho: zohoResponse.data,
//       message: "Ticket updated successfully"
//     };

//   } catch (error) {
//     console.error("Error updating ticket:", error);

//     // Normalize error format
//     throw {
//       status: error.status || error.response?.status || 500,
//       message: error.message || error.response?.data?.message || "Failed to update ticket"
//     };
//   }
// };




export const updateZohoTicketStatusFraudRule = async (
  ticketId,
  zohoStatus,
  data,
  fraudType
) => {
  try {
    console.log("Incoming:", { ticketId, zohoStatus, data, fraudType });

    if (!ticketId) {
      throw { status: 400, message: "Ticket ID is required" };
    }

    if (!data || Object.keys(data).length === 0) {
      throw { status: 400, message: "No data provided" };
    }

    // Safe object creation
    data.cf = data.cf || {};
    data.cf.cf_fraud_type = fraudType;
    data.status = zohoStatus;

    // Generate Zoho token
    const tokenDetails = await generateAccessToken({
      accessToken: null,
      expiresAt: null
    });

    // 1. Fetch existing Zoho ticket
    const existingTicketRes = await axios({
      method: "get",
      url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
      headers: {
        orgId: process.env.ZOHO_ORG_ID,
        Authorization: `Zoho-oauthtoken ${tokenDetails.accessToken}`
      }
    });

    const existingTicket = existingTicketRes.data;

    // 2. Merge cf fields safely
    const mergedData = {
      ...data,
      cf: {
        ...(existingTicket.cf || {}),
        ...(data.cf || {})
      }
    };

    console.log("Merged payload:", mergedData);

    // 3. Update Zoho ticket
    const zohoResponse = await axios({
      method: "patch",
      url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
      headers: {
        orgId: process.env.ZOHO_ORG_ID,
        Authorization: `Zoho-oauthtoken ${tokenDetails.accessToken}`,
        "Content-Type": "application/json"
      },
      data: mergedData
    });

    console.log("Zoho updated:", zohoResponse.data);

    // 4. Build safe MongoDB update object
    const setObject = {
      updatedAt: new Date()
    };

    for (const key in mergedData) {
      if (key === "cf") {
        for (const cfKey in mergedData.cf) {
          setObject[`cf.${cfKey}`] = mergedData.cf[cfKey];
        }
      } else {
        setObject[key] = mergedData[key];
      }
    }

    // 5. Update MongoDB ticket
    const updatedMongoTicket = await Ticket.findOneAndUpdate(
      { zohoTicketId: ticketId },
      { $set: setObject },
      { new: true }
    );

    if (!updatedMongoTicket) {
      throw {
        status: 404,
        message: "Ticket updated in Zoho but not found in local DB"
      };
    }

    return {
      success: true,
      message: "Ticket updated successfully",
      data: updatedMongoTicket,
      zoho: zohoResponse.data
    };
  } catch (error) {
    console.error("Error updating ticket:", error);

    throw {
      status: error.status || error.response?.status || 500,
      message:
        error.message ||
        error.response?.data?.message ||
        "Failed to update ticket"
    };
  }
};



export const uploadAttachmentToZohoTicket = async (ticketId, fileUrls, orgId) => {

  const urls = Array.isArray(fileUrls) ? fileUrls : [fileUrls];
  const results = [];

  const tokenDetails = await generateAccessToken({
    accessToken: null,
    expiresAt: null
  });


  for (const fileUrl of urls) {
    try {

      // Download file as stream
      const fileStream = await axios.get(fileUrl, { responseType: "stream" });

      // Create form
      const form = new FormData();
      form.append("file", fileStream.data, {
        filename: path.basename(fileUrl),
      });


      const url = `https://desk.zoho.in/api/v1/tickets/${ticketId}/attachments`;
      const headers = {
        ...form.getHeaders(),
        'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
        'orgId': orgId,
      };


      const resp = await axios.post(url, form, { headers });
      console.log('Upload response of attachment:', resp.data);
      return resp.data; // contains details of attachment



    } catch (error) {
      console.error('Error uploading attachment:', err.response?.data || err.message);
      throw err;
    }
  }

}

const filePaths = [path.join(__dirname, "../..", "uploads", "kycImage-1757498741475-236737321.png")]

// uploadAttachmentToZohoTicket(
//   "210686000000947661",
//   filePaths,
//   "60046723098"
// );
// uploadAttachmentToZohoTicket(
//   "210686000000947661",
//   "https://dwzytf8fljslz.cloudfront.net/22699_JK_Tyre_Website_Individual_Banners_05_a7c332734e.jpg?format=auto&width=384&quality=75",
//   "60046723098"
// );