import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS,
    secretAccessKey: process.env.AWS_SECRET,
  },
});

export async function uploadFileToStorage(file) {
  try {
    const fileStream = fs.createReadStream(file.path);

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: "pwd-mobility",
        Key: `uploads/${Date.now()}-${file.originalname}`,
        Body: fileStream,
        ContentType: file.mimetype,
      },
    });

    const result = await upload.done();
    return result.Location;  
  } catch (error) {
    console.error("S3 upload error:", error);
    throw error;
  }
}
