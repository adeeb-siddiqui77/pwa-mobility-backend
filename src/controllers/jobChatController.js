import JobChatSession from '../models/JobChatSession.js';
import { uploadFileToStorage } from '../utils/fileUpload.js'; // implement or reuse your helper
import { verifyVehiclePlate, verifyStencil } from '../services/verificationService.js'; // see notes
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import { getNextValues } from '../services/issueMapping.js';
import { IssueModel } from '../models/IssueSchema.js';

/**
 * GET /api/jobchat/:ticketId
 * returns existing session or creates a new one
 */

function makeInitialBotMessagesServer(ticketId, driverName, driverPhone) {
    const msgs = [];

    const detailsText =
        `Hi there 👋\nHere are the details for your latest service ticket:\nTicket ID: ${ticketId}` +
        (driverName ? `\nDriver Name: ${driverName}` : "") +
        (driverPhone ? `\nContact: ${driverPhone}` : "");

    msgs.push({
        who: 'bot',
        text: detailsText,
        meta: {},
        createdAt: new Date()
    });

    const platePrompt = 'Please upload a photo of the vehicle’s number plate to verify the record.';
    msgs.push({
        who: 'bot',
        text: `${platePrompt}`,
        meta: { action: 'capture_image' },
        createdAt: new Date()
    });

    return msgs;
}


export async function getSession(req, res) {
    try {
        const ticketId = req.params.ticketId;
        const mechanicId = req.query.mechanicId;
        if (!ticketId || !mechanicId) return res.status(400).json({ message: 'ticketId & mechanicId required' });

        // fetch driver details via ticketId

        const response = await Ticket.findOne({ zohoTicketId: ticketId })
        let driverName = response?.cf?.cf_driver_name
        let driverPhone = response?.cf?.cf_driver_phone_number

        let session = await JobChatSession.findOne({ ticketId, mechanicId });
        if (!session) {
            // create session with initial bot messages persisted
            const initialMessages = makeInitialBotMessagesServer(ticketId, driverName, driverPhone);
            session = await JobChatSession.create({
                ticketId,
                mechanicId,
                messages: initialMessages,
                flowIndex: 1, // start at vehicle_plate step
                status: 'in_progress',
                lastUpdatedAt: new Date()
            });
            // return the newly created session (with initial messages)
            return res.json({ success: true, data: session });
        }

        return res.json({ success: true, data: session });
    } catch (err) {
        console.error('getSession', err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * POST /api/jobchat/:ticketId/message
 * Accepts multipart form: who=text fields; optional file
 * If step expects verification, calls verificationService and advances flow accordingly.
 */
export async function postMessage(req, res) {
    try {
        const ticketId = req.params.ticketId;
        const mechanicId = req.user?._id || req.body.mechanicId;
        if (!ticketId || !mechanicId) return res.status(400).json({ message: 'ticketId & mechanicId required' });

        let session = await JobChatSession.findOne({ ticketId, mechanicId });
        if (!session) {
            session = await JobChatSession.create({ ticketId, mechanicId, messages: [], flowIndex: 0 });
        }

        // find the ticketObject

        const ticketDetails = await Ticket.findOne({ zohoTicketId: ticketId })

        // console.log("ticketDetails", ticketDetails)

        // Save uploaded file (if any) and get public URL
        let imageUrl = null;
        if (req.file) {
            // uploadFileToStorage should return a public URL
            imageUrl = await uploadFileToStorage(req.file);

            console.log("imageURL", imageUrl)
        }

        const who = req.body.who || 'mechanic';
        const text = req.body.text || '';
        const msg = { who, text, imageUrl, meta: req.body.meta ? JSON.parse(req.body.meta) : {} };
        session.messages.push(msg);
        session.lastUpdatedAt = new Date();

        // Determine current step (flowIndex) BEFORE adding verification results
        const flowIndexBefore = session.flowIndex || 0;

        // Save optimistic
        await session.save();

        // If current step requires verification and a file exists, call verification service
        // Map of step index -> handler (you can base on a central BOT_FLOW)
        // Example: step 1 = vehicle plate verification, step 2 = stencil verification
        // Adjust indices to match your flow
        const handlers = {
            1: async () => { // vehicle plate verify
                if (!imageUrl) return { ok: false, message: 'No image provided' };
                const plateResult = await verifyVehiclePlate(imageUrl, ticketId); // implement this

                console.log("plateResult", plateResult)

                if (plateResult.success) {
                    session.messages.push({ who: 'bot', text: `The vehicle ${plateResult.ocrPlate} is verified.`, createdAt: new Date() });
                    session.messages.push({ who: 'bot', text: `Upload the tyre’s stencil number`, createdAt: new Date() });
                    session.flowIndex = flowIndexBefore + 1; // advance to stencil step
                } else {
                    session.messages.push({ who: 'bot', text: `Vehicle verification failed: ${plateResult.message || 'Unknown'}`, createdAt: new Date() });
                }
                await session.save();
            },
            2: async () => { // stencil verify
                if (!imageUrl) return { ok: false, message: 'No image provided' };
                const stencilResult = await verifyStencil(imageUrl);

                if (stencilResult.success) {
                    session.messages.push({ who: 'bot', text: `The stencil number ${stencilResult.stencilNumber} is verified`, createdAt: new Date() });
                    session.messages.push({ who: 'bot', text: 'Capture and upload a photo of tyre issues', createdAt: new Date() })
                    session.flowIndex = flowIndexBefore + 1; // advance to issue selection step
                } else {
                    session.messages.push({ who: 'bot', text: `Stencil verification failed: ${stencilResult.message || 'Unknown'}`, createdAt: new Date() });
                }
                await session.save();
            },
            3: async () => { // tyre issue image
                if (!imageUrl) return { ok: false, message: 'No tyre issue image provided' };
                // const stencilResult = await verifyStencil(imageUrl );



                session.messages.push({ who: 'bot', text: 'Before you get started, just pick the issues from the list below.', createdAt: new Date() })
                session.flowIndex = flowIndexBefore + 1;
                await session.save();
            },
            4: async () => {
                let chatElem = session?.messages[session.messages.length - 1];
                let selectedIssues = chatElem?.meta?.issues;

                // console.log('selectedIssues', selectedIssues);

                const result = await getNextValues(selectedIssues);
                console.log("inside index4")

                console.log("session in step4" , session)


                if(session.messages[session.messages.length - 1].meta.step == "finalMapping"){
                    session.messages.push({ who: 'bot', text: 'Please upload a photo of the repaired tyre for completion proof.', createdAt: new Date() })
                    session.flowIndex = flowIndexBefore + 1;
                    await session.save();
                }
            },
            5 : async () =>{
                if (!imageUrl) return { ok: false, message: 'No repaired tyre image provided' };
                
                console.log('imageUrl inside the post repaired' , imageUrl)
                session.messages.push({ who: 'bot', text: 'Image received and saved successfully Updating your service summary…', createdAt: new Date() })
                session.messages.push({ who: 'bot', text: 'Here’s the rate card for the services you provided:', createdAt: new Date() , meta : {rateCard : "value"} })
                // session.messages.push({ who: 'bot', text: 'Please confirm the services to generate the invoice.', createdAt: new Date() , meta : {rateCardConfirmation : "this will contain that"} })

                session.flowIndex = flowIndexBefore + 1;

                await session.save()

                
            }

            // add more handlers as needed for other steps
        };

        if (handlers[flowIndexBefore]) {
            // run handler asynchronously but wait — we want to return updated session
            try {
                await handlers[flowIndexBefore]();
            } catch (err) {
                console.error('verification handler error', err);
            }
        }

        // Respond with updated session
        const updated = await JobChatSession.findOne({ ticketId, mechanicId });
        return res.json({ success: true, data: updated });
    } catch (err) {
        console.error('postMessage', err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * PATCH /api/jobchat/:ticketId
 * body: { flowIndex, status }
 */
export async function patchSession(req, res) {
    try {
        const ticketId = req.params.ticketId;
        const mechanicId = req.user?._id || req.body.mechanicId;
        if (!ticketId || !mechanicId) return res.status(400).json({ message: 'ticketId & mechanicId required' });

        const updates = {};
        if (typeof req.body.flowIndex === 'number') updates.flowIndex = req.body.flowIndex;
        if (req.body.status) updates.status = req.body.status;
        updates.lastUpdatedAt = new Date();

        const session = await JobChatSession.findOneAndUpdate({ ticketId, mechanicId }, { $set: updates }, { new: true });
        return res.json({ success: true, data: session });
    } catch (err) {
        console.error('patchSession', err);
        res.status(500).json({ success: false, message: err.message });
    }
}
