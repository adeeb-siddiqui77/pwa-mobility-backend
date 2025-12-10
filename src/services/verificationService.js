

import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import Ticket from "../models/Ticket.js";
import axios from "axios";

const router = express.Router();


const upload = multer({ dest: "uploads/" });

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});




async function readPlate(imageUrlOrBase64) {
    const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: imageUrlOrBase64,
                        }
                    },
                    {
                        type: "text",
                        text: "Extract ONLY the vehicle number plate from this image. Return just the plate string (e.g. 'DL8CAF5030') with no extra words."
                    }
                ]
            }
        ],
        max_tokens: 20
    });

    // For chat.completions, response content is a plain string
    return response.choices[0].message.content.trim();
}


async function readImageText(imageUrlOrBase64, instruction) {
    const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: { url: imageUrlOrBase64 }
                    },
                    {
                        type: "text",
                        text: instruction
                    }
                ]
            }
        ],
        max_tokens: 100
    });

    return response.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function verifyVehiclePlate(imageInput, ticketId) {

    console.log('image url inside plate verification', imageInput)
    try {
        const numberPlate = await readPlate(imageInput);

        const response = await Ticket.findOne({ zohoTicketId: ticketId });
        const raisedVehicleNumber = response?.cf?.cf_driver_vehicle_number;

        return {
            success: numberPlate === raisedVehicleNumber,
            message: numberPlate === raisedVehicleNumber
                ? "The vehicle is verified."
                : "The vehicle is not verified.",
            ocrPlate: numberPlate,
            ticketPlate: raisedVehicleNumber
        };

    } catch (error) {
        console.error("OCR ERROR:", error);
        return {
            success: false,
            error: error.message
        };
    }
}


export async function verifyStencil(imageInput) {
    try {
        // Make sure we have an image input
        if (!imageInput) {
            return {
                success: false,
                message: "Provide imageUrl OR upload an image."
            };
        }

        // OCR Prompt
        const ocrPrompt = [
            "You are an OCR assistant. Extract ONLY the tyre stencil/serial number printed on the tyre.",
            "Return the stencil in the format: STENCIL: <value>. If multiple found, return the most readable one.",
            "If nothing recognizable, return: STENCIL: NOT_FOUND"
        ].join(" ");

        // Perform OCR
        const ocrResult = await readImageText(imageInput, ocrPrompt);

        // Try strict extraction
        let stencil = null;
        const m = ocrResult?.match(/STENCIL:\s*(.+)/i);
        if (m) {
            stencil = m[1].trim();
        } else {
            // Fallback heuristic
            const tokens = ocrResult
                ?.split(/\s|,|;|\n/)
                .map(t => t.trim())
                .filter(Boolean);

            const candidate = tokens?.find(t => /[A-Za-z0-9\-]{5,}/.test(t));

            stencil = candidate || ocrResult?.trim() || null;
        }

        // Handle "NOT_FOUND"
        if (!stencil || stencil.toUpperCase() === "NOT_FOUND") {
            return {
                success: true,
                stencil: null,
                validation: {
                    status: "not_found",
                    message: "No stencil found"
                }
            };
        }


        // Clean the stencil before API call
        const cleanStencil = stencil
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");  // remove spaces & symbols


        console.log("cleanStencil number" , cleanStencil)


        const apiResponse = await axios.post(
            "https://fleet.jktyre.co.in/api/v1/tyre/webhook/checkStencil",
            { stencilNo: cleanStencil },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic YXBwbG9yZV9jb24xOmFwcGxvcmVfY29uMTIz"
                },
                validateStatus: () => true
            }
        );

        const apiData = apiResponse.data;

        if (apiData?.success === true) {
            return {
                success: true,
                stencilNumber: cleanStencil,
                jkTyreValidation: apiData
            };
        }

        return {
            success: false,
            stencilNumber: cleanStencil,
            message: apiData?.message || "Stencil not found",
            jkTyreValidation: apiData
        };

        // Success response
        // return {
        //     success: true,
        //     stencilNumber: stencil,
        //     jkTyreValidation: apiResponse.data
        // };

    } catch (error) {
        console.error("Stencil OCR ERROR:", error);
        return {
            success: false,
            error: error.message
        };
    }
}