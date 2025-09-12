
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import Driver from './models/Driver.js';

dotenv.config();


// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Excel file path
const filePath = path.join(__dirname, 'Driver_Master_Data.xlsx');

// MongoDB connection

async function importDrivers() {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    if (!fs.existsSync(filePath)) {
            console.error('Excel file not found at', filePath);
            process.exit(1);
        }

    // Load Excel file
    const workbook = xlsx.readFile(filePath
        
    );
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    // Transform data
    const drivers = rows.map((row) => ({
      vehicleNo: row["Vehicle No."],
      driverName: row["Driver Name"],
      driverPhone: String(row["Driver's Phone number"]).split(".")[0], // convert scientific notation to string
    }));

    // Insert into MongoDB
    await Driver.insertMany(drivers);
    console.log("✅ Drivers imported successfully!");

    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error importing drivers:", error);
    mongoose.connection.close();
  }
}

importDrivers();
