import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

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

router.post("/number-plate", upload.single("image"), async (req, res) => {
    try {
        let imageInput;

        console.log("req.body" , req.body)

        // Case: image URL
        if (req.body.imageUrl) {
            imageInput = req.body.imageUrl;
        }

        // Case: uploaded file
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

        return res.json({
            success: true,
            numberPlate
        });

    } catch (err) {
        console.error("OCR ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

export default router;
