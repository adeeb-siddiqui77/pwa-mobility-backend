// src/services/waNotifyDriver.js

import User from "../models/User.js";
import { sendLocationMessage, sendSimpleMessage } from "./waSender.js";


export async function notifyDriverOnAccept(ticketData, mechanicId) {

  try {
    const driverPhone = ticketData?.cf?.cf_driver_phone_number;
    if (!driverPhone) {
      console.log('No driver phone available for this driver:', driverPhone);
      return;
    }

    const mechanic = await User.findById(mechanicId);

    // console.log('Mechanic:', mechanic);
    if (!mechanic) {
      console.log('Mechanic not found:', mechanicId);
      return;
    }

    const message =
      `✅ *Pitstop Details*\n\n` +
      `Name: ${mechanic?.shopName}\n` +
      `Address: ${mechanic?.address}\n` +
      `Contact: ${mechanic?.mobile}\n` +
      `The Pitshop location is attached below`;

    console.log(`[WA] Sending driver confirmation: ${driverPhone}`);
    const res = await sendSimpleMessage({ to: driverPhone, text: message });
    console.log(`[WA] Driver confirmation sent:`, res);


    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await wait(5000);
    
    const locationRes = await sendLocationMessage({to : driverPhone , latitude: mechanic.location.coordinates[1], longitude: mechanic.location.coordinates[0], name: mechanic.shopName})
  } catch (err) {
    console.error('Failed to send driver confirmation message:', err.message);
  }
}
