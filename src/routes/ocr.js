import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import Ticket from "../models/Ticket.js";

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

router.post("/number-plate", upload.single("image"), async (req, res) => {
    try {
        let imageInput;
        if (req.body.imageUrl) {
            imageInput = req.body.imageUrl;
        }
        else if (req.file) {
            const buffer = fs.readFileSync(req.file.path);
            fs.unlinkSync(req.file.path);

            imageInput = `data:image/jpeg;base64,${buffer.toString("base64")}`;
        }

        else {
            return res.status(400).json({
                success: false,
                message: "Provide imageUrl OR upload an image."
            });
        }

        const numberPlate = await readPlate(imageInput);

        let ticketId = req.body.ticketId;
        let raisedVehicleNumber;

        const response = await Ticket.findOne({ zohoTicketId: ticketId })
        raisedVehicleNumber = response?.cf?.cf_driver_vehicle_number

        if (numberPlate == raisedVehicleNumber) {
            return res.json({
                success: true,
                message: "The Vehicle is verified .",
                numberPlate
            });
        }

        return res.json({
            success: false,
            message: "The Vechicle is not verified",
            ocrPlate: numberPlate,
            ticketPlate: raisedVehicleNumber
        });

    } catch (err) {
        console.error("OCR ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});


router.post("/stencil-extract", upload.single("image"), async (req, res) => {
    try {
        let imageInput;
        if (req.body.imageUrl) {
            imageInput = req.body.imageUrl;
        }
        else if (req.file) {
            const buffer = fs.readFileSync(req.file.path);
            fs.unlinkSync(req.file.path);

            imageInput = `data:image/jpeg;base64,${buffer.toString("base64")}`;
        }

        else {
            return res.status(400).json({
                success: false,
                message: "Provide imageUrl OR upload an image."
            });
        }

        const ocrPrompt = [
            "You are an OCR assistant. Extract ONLY the tyre stencil/serial number printed on the tyre. ",
            "Return the stencil in the format: STENCIL: <value>. If multiple found, return the most readable one. ",
            "If nothing recognizable, return: STENCIL: NOT_FOUND"
        ].join(" ");

        const ocrResult = await readImageText(imageInput, ocrPrompt);

        let stencil = null;
        const m = ocrResult.match(/STENCIL:\s*(.+)/i);
        if (m) stencil = m[1].trim();
        else {
            // quick heuristic: choose first alphanumeric token of length > 4
            const tokens = ocrResult.split(/\s|,|;|\n/).map(t => t.trim()).filter(Boolean);
            const candidate = tokens.find(t => /[A-Za-z0-9\-]{5,}/.test(t));
            stencil = candidate || (ocrResult ? ocrResult.trim() : null);
        }

        if (!stencil || stencil.toUpperCase() === "NOT_FOUND") {
            return res.json({
                success: true,
                stencil: null,
                validation: { status: "not_found", message: "No stencil found" }
            });
        }

        return res.json({
            success: true,
            stencilNumber: stencil,
            // validation: validationResult
        });

    } catch (err) {
        console.error("Stencil OCR ERROR:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});


router.post("/stencil-validate", async (req, res) => {
    try {
        let { stencilNumber } = req.body

        const thirdPartyUrl = process.env.STENCIL_VALIDATION_URL; // e.g. https://api.example.com/validate-stencil
        const thirdPartyApiKey = process.env.STENCIL_VALIDATION_KEY;

        let validationResult = null;
        try {
            const thirdResp = await axios.post(
                thirdPartyUrl,
                { stencilNumber },
                {
                    headers: {
                        Authorization: `Bearer ${thirdPartyApiKey}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 10000
                }
            );

            validationResult = thirdResp.data;
        } catch (e) {
            console.error("Third-party validation error:", e?.response?.data || e.message);
            validationResult = { status: "error", message: "Validation service failed", detail: e?.message || null };
        }
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

export default router;
