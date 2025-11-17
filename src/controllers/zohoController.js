import axios from 'axios';
import dotenv from 'dotenv';
import { generateAccessToken, getValidAccessToken } from '../services/tokenService.js';
import Ticket from '../models/Ticket.js';
import Users from '../models/User.js';
import mongoose from "mongoose";

dotenv.config();

// Controller to get tickets
// export const getMechanicTickets = async (req, res) => {
//     try {
//         const mechanicId = new mongoose.Types.ObjectId(req.query.mechanicId);
//         const page = parseInt(req.query.page) || 1;
//         const limit = 5;
//         const skip = (page - 1) * limit;

//         // First, get tickets from MongoDB
//         const mongoTickets = await Ticket.find({ mechanicId })
//             .sort({ updatedAt: -1 })
//             .skip(skip)
//             .limit(limit);

//         // Get access token for Zoho API
//         const accessToken = await getValidAccessToken();

//         // Fetch detailed information for each ticket from Zoho
//         const ticketDetailsPromises = mongoTickets.map(async (ticket) => {
//             try {
//                 const config = {
//                     method: 'get',
//                     url: `https://desk.zoho.in/api/v1/tickets/${ticket.zohoTicketId}`,
//                     params: {
//                         include: 'contacts,products,assignee,departments,team'
//                     },
//                     headers: {
//                         'orgId': process.env.ZOHO_ORG_ID,
//                         'Authorization': `Zoho-oauthtoken ${accessToken}`
//                     }
//                 };

//                 const zohoResponse = await axios(config);
//                 return {
//                     ...zohoResponse.data,
//                     mechanicId: ticket.mechanicId,
//                     _id: ticket._id,
//                     localCreatedAt: ticket.createdAt,
//                     localUpdatedAt: ticket.updatedAt
//                 };
//             } catch (error) {
//                 console.error(`Error fetching Zoho ticket ${ticket.zohoTicketId}:`, error);
//                 // Return the MongoDB ticket data if Zoho fetch fails
//                 return ticket;
//             }
//         });

//         const ticketsWithDetails = await Promise.all(ticketDetailsPromises);
//         const totalTickets = await Ticket.countDocuments({ mechanicId });

//         res.json({
//             tickets: ticketsWithDetails,
//             pagination: {
//                 currentPage: page,
//                 totalPages: Math.ceil(totalTickets / limit),
//                 totalTickets,
//                 limit
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching tickets:', error);
//         res.status(500).json({
//             error: 'Failed to fetch tickets',
//             message: error.message
//         });
//     }
// };


export const getMechanicTickets = async (req, res) => {
    try {
        const mechanicId = new mongoose.Types.ObjectId(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // First, get tickets from MongoDB
        const mongoTickets = await Ticket.find({ mechanicId })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalTickets = await Ticket.countDocuments({ mechanicId });

        res.json({
            tickets: mongoTickets,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalTickets / limit),
                totalTickets,
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({
            error: 'Failed to fetch tickets',
            message: error.message
        });
    }
};



export const getTickets = async (req, res) => {
    try {
        let tokenDetails = {
            accessToken: req.query.accessToken,
            expiresAt: req.query.expiresAt

        }

        const validaccessToken = await getValidAccessToken(tokenDetails);
        const config = {
            method: 'get',
            url: 'https://desk.zoho.in/api/v1/tickets',
            params: {
                include: 'contacts,assignee,departments,team,isRead'
            },
            headers: {
                'orgId': process.env.ZOHO_ORG_ID,
                'Authorization': `Zoho-oauthtoken ${validaccessToken.accessToken}`
            }
        };

        const response = await axios(config);

        response.data.tokenDetails = validaccessToken;
        return res.status(200).json({
            data: response.data,
            message: 'Tickets fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({
            error: 'Failed to fetch tickets',
            message: error.message
        });
    }
};

export const createTicket = async (req, res) => {
    try {
        let { mechanicId, ticketData } = req.body;

        console.log("Mechanic ID:", mechanicId);
        mechanicId = new mongoose.Types.ObjectId(mechanicId);

        console.log("Received ticket creation request:", { mechanicId, ticketData });

        // Find mechanic by mechanicId
        const mechanic = await Users.findOne({ _id: mechanicId });

        console.log("Mechanic found:", mechanic);
        if (!mechanic) {
            return res.status(404).json({
                error: 'Mechanic not found',
                message: 'No mechanic found with the provided mechanicId'
            });
        }

        const tokenDetails = await getValidAccessToken({
            accessToken: null,
            expiresAt: null

        });

        console.log("Access Token:", tokenDetails);

        // Default values combined with request body
        const zohoTicketData = {
            ...ticketData
        };

        console.log("Creating Zoho ticket with data:", zohoTicketData);

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

        res.status(201).json({
            data: mongoTicket.toObject(),
            message: "Ticket created successfully",
            zohoTicket: zohoTicket,
            zohoTicketData : zohoTicketData,
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({
            error: 'Failed to create ticket',
            message: error.response?.data?.message || error.message
        });
    }
};

// export const getTicketById = async (req, res) => {
//     try {
//         const { ticketId } = req.params;

//         // First check if ticket exists in MongoDB
//         const mongoTicket = await Ticket.findOne({ zohoTicketId: ticketId });
//         if (!mongoTicket) {
//             return res.status(404).json({
//                 error: 'Ticket not found',
//                 message: 'No ticket found with the provided ID'
//             });
//         }

//         // Get access token for Zoho API
//         const accessToken = await getValidAccessToken();

//         // Fetch detailed information from Zoho
//         const config = {
//             method: 'get',
//             url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
//             params: {
//                 include: 'contacts,products,assignee,departments,team'
//             },
//             headers: {
//                 'orgId': process.env.ZOHO_ORG_ID,
//                 'Authorization': `Zoho-oauthtoken ${accessToken}`
//             }
//         };

//         const zohoResponse = await axios(config);

//         // Combine Zoho and local data
//         const ticketData = {
//             ...zohoResponse.data,
//             mechanicId: mongoTicket.mechanicId,
//             _id: mongoTicket._id,
//             localCreatedAt: mongoTicket.createdAt,
//             localUpdatedAt: mongoTicket.updatedAt
//         };

//         res.json(ticketData);
//     } catch (error) {
//         console.error('Error fetching ticket:', error);
//         res.status(error.response?.status || 500).json({
//             error: 'Failed to fetch ticket',
//             message: error.response?.data?.message || error.message
//         });
//     }
// };


export const updateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        let { data , tokenDetails} = req.body;

        // console.log("Update request received for ticketId:", ticketId, "with data:", data, "and tokenDetails:", tokenDetails);

        if (!ticketId) {
            return res.status(400).json({
                error: 'Missing ticket ID',
                message: 'Ticket ID is required in the URL'
            });
        }

        if (!data|| Object.keys(data).length === 0) {
            return res.status(400).json({
                error: 'No data provided',
                message: 'Request body is empty'
            });
        }

        // tokenDetails = await getValidAccessToken(tokenDetails);
        tokenDetails = await generateAccessToken({accessToken: null, expiresAt: null});
        console.log("Valid access token:", tokenDetails.accessToken);



        console.log("Data:", data);

        // Update in Zoho
        const config = {
            method: 'patch',
            url: `https://desk.zoho.in/api/v1/tickets/${ticketId}`,
            headers: {
                'orgId': process.env.ZOHO_ORG_ID,
                'Authorization': `Zoho-oauthtoken ${tokenDetails.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: data
        };

        const zohoResponse = await axios(config);
        console.log("Zoho update response:", zohoResponse.data);

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
            return res.status(404).json({
                error: 'Ticket not found in local database',
                message: 'The ticket was updated in Zoho but could not be found in the local database'
            });
        }

        res.json({
            data : updatedMongoTicket,
            message: "Ticket updated successfully"
        });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to update ticket',
            message: error.response?.data?.message || error.message
        });
    }
};



export const updateTicketinMongo = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { preRepairPhotos, workDetails, postRepairPhotos , status } = req.body;

        console.log("Update request received for ticketId:", ticketId, "with data:", preRepairPhotos, workDetails, postRepairPhotos);
        
        if (!ticketId) {
            return res.status(400).json({
                error: 'Missing ticket ID',
                message: 'Ticket ID is required in the URL'
            });
        }

        const updatedMongoTicket = await Ticket.findOneAndUpdate(
            { zohoTicketId: ticketId },
            {
                $set: {
                    preRepairPhotos, 
                    workDetails, 
                    postRepairPhotos,
                    status,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );
      


        if (!updatedMongoTicket) {
            return res.status(404).json({
                error: 'Ticket not found in local database',
                message: 'The ticket was updated in Zoho but could not be found in the local database'
            });
        }

        res.json({
           data: updatedMongoTicket,
           message: "Ticket updated successfully"
        });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to update ticket',
            message: error.response?.data?.message || error.message
        });
    }
};



