// src/services/zohoService.js
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js'
import Ticket from '../models/Ticket.js';

import { getValidAccessToken } from './tokenService.js';


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

  const tokenDetails = await getValidAccessToken({ accessToken: null, expiresAt: null });
  if (!tokenDetails || !tokenDetails.accessToken) {
    throw new Error('Zoho access token not available');
  }

  console.log("Access Token:", tokenDetails);


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


  console.log("Zoho ticket:", zohoTicket);

  // Create replica in MongoDB
  const mongoTicket = await Ticket.create({
    zohoTicketId: zohoTicket.id,
    mechanicId: mechanicId,
    ...zohoTicket
  });

  console.log("Ticket created in Zoho and MongoDB:", { mongoTicket });


  return { zohoTicket, mongoTicket };
}
