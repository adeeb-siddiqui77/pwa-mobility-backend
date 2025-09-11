// import mongoose from 'mongoose';
// import fs from 'fs';
// import path from 'path';
// import XLSX from 'xlsx';
// import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';
// import User from './models/User.js'; // Adjust the path if needed

// dotenv.config();

// // Get __dirname equivalent in ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// async function connectDB() {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);
//         console.log('MongoDB connected');
//     } catch (error) {
//         console.error('MongoDB connection error:', error);
//         process.exit(1);
//     }
// }


// async function importUsers() {
//     try {
//         const filePath = path.join(__dirname, 'userData.xlsx');
        
//         if (!fs.existsSync(filePath)) {
//             console.error('Excel file not found:', filePath);
//             return;
//         }

//         const fileBuffer = fs.readFileSync(filePath);
//         const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
//         const sheetName = workbook.SheetNames[0];
//         const worksheet = workbook.Sheets[sheetName];
//         const rows = XLSX.utils.sheet_to_json(worksheet);

//         if (rows.length === 0) {
//             console.error('Excel file is empty');
//             return;
//         }

//         let insertedCount = 0;

//         for (const row of rows) {
//             // Extract and normalize fields
//             const primaryContact = row['Primary Contact No'] ? String(row['Primary Contact No']).trim() : '';
//             const mobile = primaryContact.split('/')[0].trim(); // Take the first number if multiple
        
//             const ownerName = row['OWNER NAME'] ? String(row['OWNER NAME']).trim() : '';
//             const fullName = ownerName;
        
//             const postalAddress = row['Postal Address'] ? String(row['Postal Address']).trim() : '';
//             const address = postalAddress;
        
//             const pin = row['PIN Code'] ? String(row['PIN Code']).trim() : '';
        
//             const shopName = row['Shop Name'] ? String(row['Shop Name']).trim() : '';
        
//             // Check for essential fields
//             if (!mobile || !fullName || !shopName || !address || !pin) {
//                 console.warn('Skipping incomplete row:', row);
//                 continue;
//             }
        
//             // Check if user already exists by mobile
//             const existingUser = await User.findOne({ mobile });
//             if (existingUser) {
//                 console.log(`User with mobile ${mobile} already exists. Updating...`);
//                 existingUser.fullName = fullName;
//                 existingUser.address = address;
//                 existingUser.shopName = shopName;
//                 existingUser.pin = pin;
//                 await existingUser.save();
//                 continue;
//             }
            
        
//             // Create new user entry, assigning shared fields to both schema attributes
//             const newUser = new User({
//                 mobile,
//                 pin,
//                 fullName,
//                 shopName,
//                 address,
//                 businessDays: [],
//                 timeFrom: '',
//                 timeTo: '',
//                 upi: '',
//                 adharCard: row['Aadhar Card Number'] ? String(row['Aadhar Card Number']).trim() : '',
//                 loiForm: '',
//                 kycImage: '',
//                 qrCode: '',
//                 isFirstLogin: true,
//                 createdBy: null
//             });
        
//             await newUser.save();
//             insertedCount++;
//         }
        

//         console.log(`Successfully inserted ${insertedCount} users.`);
//         process.exit(0);
//     } catch (error) {
//         console.error('Error during import:', error);
//         process.exit(1);
//     }
// }

// async function main() {
//     await connectDB();
//     await importUsers();
// }

// main();


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import User from './models/User.js'; // Adjust path if needed

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Excel file path
const filePath = path.join(__dirname, 'userData.xlsx');

function excelDateToJSDate(serial) {
    if (!serial) return undefined;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info;
}

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdbname');
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function importUsers() {
    await connectDB();

    if (!fs.existsSync(filePath)) {
        console.error('Excel file not found at', filePath);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    let insertedCount = 0;

    let invalidMobileNumbers = [];
    // let skippedUsers = []
    let repeatedMobileNumbers = [];

    for (const row of rows) {
        try {
            // --- Core attributes mapping ---
            const primaryContact = row['Primary Contact No'] ? String(row['Primary Contact No']).trim() : '';
            const mobile = primaryContact.split('/')[0].replace(/[^0-9]/g, '');
            const ownerName = row['OWNER NAME'] ? String(row['OWNER NAME']).trim() : '';
            const fullName = ownerName || 'Unknown';
            const postalAddress = row['Postal Address'] ? String(row['Postal Address']).trim() : '';
            const address = postalAddress || 'Unknown';
            const shopName = row['Shop Name'] ? String(row['Shop Name']).trim() : '';

            if (!mobile) {
                console.warn('Skipping incomplete row (check values):', {
                    mobile
                });
                invalidMobileNumbers.push(mobile);
                continue;
            }

            const existingUser = await User.findOne({ mobile });
            if (existingUser) {
                console.warn(`User with mobile ${mobile} already exists. Skipping.`);
                repeatedMobileNumbers.push(mobile)
                continue;
            }

            // --- Prepare user data ---
            const userData = {
                mobile,
                pin: "12346",
                fullName,
                shopName,
                address,
                businessDays: [],
                timeFrom: '',
                timeTo: '',
                upi: '',
                adharCard: row['Aadhar Card Number'] ? String(row['Aadhar Card Number']).trim() : '',
                loiForm: '',
                kycImage: '',
                qrCode: '',
                isFirstLogin: true,
                createdBy: null,

                // Extra Excel fields
                dateOfOnboarding: new Date(),
                jkmfClosedInActiveDate: new Date(),
                jkmfRegNoNew: row['JKMF Reg. No.(New)'] ? String(row['JKMF Reg. No.(New)']).trim() : undefined,
                jkmfUniqueName: row['JKMF Unique Name'] ? String(row['JKMF Unique Name']).trim() : undefined,
                location: row['Location'] ? String(row['Location']).trim() : undefined,
                jkmfInHubHighway: row['JKMF (IN HUB , HIGHWAY)'] ? String(row['JKMF (IN HUB , HIGHWAY)']).trim() : undefined,
                dedicatedToWhichFleet: row['Dedicated to which Fleet'] ? String(row['Dedicated to which Fleet']).trim() : undefined,
                loiAvailable: row['LOI Available?'] ? row['LOI Available?'].toString().toLowerCase() === 'yes' : undefined,
                status: row['STATUS (ACTIVE /NON ACTIVE/ CLOSED)'] ? String(row['STATUS (ACTIVE /NON ACTIVE/ CLOSED)']).trim() : undefined,
                inActiveReason: row['InActive Reason'] ? String(row['InActive Reason']).trim() : undefined,
                zone: row['Zone'] ? String(row['Zone']).trim() : undefined,
                zonalCoordinator: row['Zonal Coordinator'] ? String(row['Zonal Coordinator']).trim() : undefined,
                ownerName,
                primaryContactNo: primaryContact,
                secondaryContactNo: row['Secondary Contact No'] ? String(row['Secondary Contact No']).trim() : undefined,
                postalAddress,
                pinCode: row['PIN Code'] ? String(row['PIN Code']).trim() : undefined,
                state: row['State'] ? String(row['State']).trim() : undefined,
                district: row['District'] ? String(row['District']).trim() : undefined,
                googleMapsLocation: row['GOOGLE MAPS LOCATION'] ? String(row['GOOGLE MAPS LOCATION']).trim() : undefined,
                lat: row['LAT'] ? Number(row['LAT']) : undefined,
                long: row['LONG'] ? Number(row['LONG']) : undefined,
                recommendedBy: row['Recommended by'] ? String(row['Recommended by']).trim() : undefined,
                lastVehicleAttendedOn: new Date(),
                servicesFirstSep23Today: row["Services(1st Sep'23- Today)"] ? Number(row["Services(1st Sep'23- Today)"]) : undefined,
                bdsAttendedByHDTill30Apr24: row["BDs Attened by HD(Till 30th Apr'24)"] ? Number(row["BDs Attened by HD(Till 30th Apr'24)"]) : undefined,
                bdsAttendedByHDTill30Apr24_31Oct24: row["BDs Attened by HD(Till 30th Apr'24 - 31st Oct'24)"] ? Number(row["BDs Attened by HD(Till 30th Apr'24 - 31st Oct'24)"]) : undefined,
                servicesTill31Aug23: row["Services Till 31st Aug'23"] ? Number(row["Services Till 31st Aug'23"]) : undefined,
                attendedByHDTill31May25From1Nov24: row["Attended by HD Till 31st May'25 from 1st Nov'24"] ? Number(row["Attended by HD Till 31st May'25 from 1st Nov'24"]) : undefined,
                totalServices: row["Total Services"] ? Number(row["Total Services"]) : undefined,
                callingStatusAsOnAug23: row["Calling Status as on August'23"] ? String(row["Calling Status as on August'23"]).trim() : undefined,
                callingRemarks: row["Calling Remarks"] ? String(row["Calling Remarks"]).trim() : undefined,
                capableForTLTyre: row["Capable for TL Tyre?"] ? row["Capable for TL Tyre?"].toString().toLowerCase() === 'yes' : undefined,
                haveSpecificTools: row["If yes, Have specific Tools?"] ? row["If yes, Have specific Tools?"].toString().toLowerCase().includes('tt tools') : undefined,
                tShirtSize: row["T-Shirt Size"] ? String(row["T-Shirt Size"]).trim() : undefined,
                shoeSize: row["Shoe Size"] ? String(row["Shoe Size"]).trim() : undefined,
                shopCategory: row["Shop Category"] ? String(row["Shop Category"]).trim() : undefined,
                panCard: row["PAN Card"] ? String(row["PAN Card"]).trim() : undefined,
                aadharCardNumber: row["Aadhar Card Number"] ? String(row["Aadhar Card Number"]).trim() : undefined,
                nameAsPerBank: row["Name as per Bank"] ? String(row["Name as per Bank"]).trim() : undefined,
                bankName: row["Bank Name"] ? String(row["Bank Name"]).trim() : undefined,
                bankAccountNumber: row["Bank Account Number"] ? String(row["Bank Account Number"]).trim() : undefined,
                ifscCode: row["IFSC Code"] ? String(row["IFSC Code"]).trim() : undefined,
                accountStatus: row["Account Status"] ? String(row["Account Status"]).trim() : undefined,
                eligibilityFor1stReward: row["Eligibility for 1st Reward"] ? row["Eligibility for 1st Reward"].toString().toLowerCase() === 'yes' : undefined,
                firstRewardStatus: row["1st Reward Status"] ? String(row["1st Reward Status"]).trim() : undefined,
                newRewardsStatus: row["New Rewards Status"] ? String(row["New Rewards Status"]).trim() : undefined,
                billBookStatus: row["Bill Book Status"] ? String(row["Bill Book Status"]).trim() : undefined,
                firstRewardDeliveryDate: new Date(),
                rewardCycle: row["Reward Cycle"] ? String(row["Reward Cycle"]).trim() : undefined,
                eligibilityFor2ndReward: row["Eligibility for 2nd Reward"] ? row["Eligibility for 2nd Reward"].toString().toLowerCase() === 'yes' : undefined,
                certificate: row["Certificate"] ? String(row["Certificate"]).trim() : undefined,
                secondRewardStatus: row["2nd Reward Status"] ? String(row["2nd Reward Status"]).trim() : undefined,
                secondRewardDeliveryDate: new Date(),
                secondRewardCycle: row["2nd Reward Cycle"] ? String(row["2nd Reward Cycle"]).trim() : undefined,
                eligibilityFor3rdReward: row["Eligibility for 3rd Reward"] ? row["Eligibility for 3rd Reward"].toString().toLowerCase() === 'yes' : undefined,
                thirdRewardStatus: row["3rd Reward Status"] ? String(row["3rd Reward Status"]).trim() : undefined,
                thirdRewardDeliveryDate: new Date(),
                thirdRewardCycle: row["3rd Reward Cycle"] ? String(row["3rd Reward Cycle"]).trim() : undefined,
                eligibilityFor4thReward: row["Eligibility for 4th Reward"] ? row["Eligibility for 4th Reward"].toString().toLowerCase() === 'yes' : undefined,
                eligibilityFor5thReward: row["Eligibility for 5th Reward"] ? row["Eligibility for 5th Reward"].toString().toLowerCase() === 'yes' : undefined
            };

            const newUser = new User(userData);
            await newUser.save();
            insertedCount++;
        } catch (error) {
            console.error('Error inserting row:', error);
        }
    }

    console.log(`Successfully inserted ${insertedCount} users.`);
    console.log(`Skipped cause of invalid numbers ${invalidMobileNumbers.length} users.`);
    console.log(`Repeated numbers ${repeatedMobileNumbers} users. ${repeatedMobileNumbers.length}`);
    process.exit(0);
}

importUsers();
