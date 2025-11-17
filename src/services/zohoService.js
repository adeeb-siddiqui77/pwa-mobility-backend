// src/services/zohoService.js
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js'
import Ticket from '../models/Ticket.js';


import { generateAccessToken, getValidAccessToken } from './tokenService.js';


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


// export const updateZohoTicketStatusFraudRule = async (ticketId, zohoStatus, data , fraudType) => {
//   try {
//     if (!ticketId) {
//       return res.status(400).json({
//         error: 'Missing ticket ID',
//         message: 'Ticket ID is required in the URL'
//       });
//     }

//     if (!data || Object.keys(data).length === 0) {
//       return res.status(400).json({
//         error: 'No data provided',
//         message: 'Request body is empty'
//       });
//     }

//     data.cf.cf_fraud_type = fraudType;
//     data.status = zohoStatus;

//     // tokenDetails = await getValidAccessToken(tokenDetails);
//     tokenDetails = await generateAccessToken({ accessToken: null, expiresAt: null });
//     console.log("Valid access token:", tokenDetails.accessToken);



//     console.log("Data:", data);

//     // Update in Zoho
//     const config = {
//       method: 'patch',
//       url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
//       headers: {
//         'orgId': process.env.ZOHO_ORG_ID,
//         'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };


//     const zohoResponse = await axios(config);
//     console.log("Zoho update response:", zohoResponse.data);

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
//       return res.status(404).json({
//         error: 'Ticket not found in local database',
//         message: 'The ticket was updated in Zoho but could not be found in the local database'
//       });
//     }

//     res.json({
//       data: updatedMongoTicket,
//       message: "Ticket updated successfully"
//     });

//   } catch (error) {
//     console.error('Error updating ticket:', error);
//     res.status(error.response?.status || 500).json({
//       error: 'Failed to update ticket',
//       message: error.response?.data?.message || error.message
//     });
//   }
// }



export const updateZohoTicketStatusFraudRule = async (ticketId, zohoStatus, data, fraudType) => {


  console.log(ticketId, zohoStatus, data, fraudType)

  console.log("data" , data)
  try {
    if (!ticketId) {
      throw {
        status: 400,
        message: 'Ticket ID is required'
      };
    }

    if (!data || Object.keys(data).length === 0) {
      throw {
        status: 400,
        message: 'No data provided'
      };
    }

    data.cf.cf_fraud_type = fraudType;
    data.status = zohoStatus;

    // Generate Zoho token
    const tokenDetails = await generateAccessToken({
      accessToken: null,
      expiresAt: null
    });

    console.log("Valid access token:", tokenDetails.accessToken);
    console.log("Data:", data);


    // Send update to Zoho
    const config = {
      method: 'patch',
      url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
      headers: {
        'orgId': process.env.ZOHO_ORG_ID,
        'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
        'Content-Type': 'application/json'
      },
      data
    };

    const zohoResponse = await axios(config);
    console.log("Zoho update response:", zohoResponse.data);

    // Update MongoDB
    const updatedMongoTicket = await Ticket.findOneAndUpdate(
      { zohoTicketId: ticketId },
      {
        $set: {
          ...data,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedMongoTicket) {
      throw {
        status: 404,
        message: 'Ticket updated in Zoho but not found in local database'
      };
    }

    return {
      success: true,
      data: updatedMongoTicket,
      zoho: zohoResponse.data,
      message: "Ticket updated successfully"
    };

  } catch (error) {
    console.error("Error updating ticket:", error);

    // Normalize error format
    throw {
      status: error.status || error.response?.status || 500,
      message: error.message || error.response?.data?.message || "Failed to update ticket"
    };
  }
};
