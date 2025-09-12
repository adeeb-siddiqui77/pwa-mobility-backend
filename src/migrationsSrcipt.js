import mongoose from "mongoose";
import User from "./models/User.js"
import dotenv from 'dotenv';


dotenv.config();



async function migrateUsers() {
  try {
    let uri = process.env.MONGODB_URI;
    console.log("uri", uri);
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Find users that have lat/long but no GeoJSON location
    console.log("🔎 Finding users with lat/long but missing location...");
    const users = await User.find({
      lat: { $exists: true, $ne: null },
      long: { $exists: true, $ne: null },
    });

    console.log("users", users);

    console.log(`📦 Found ${users.length} users to migrate`);

    let migratedCount = 0;

    for (const userx of users) {
      const user = userx.toObject();
      console.log("user", user, user.lat, user.long);
      if (user.lat && user.long) {
        console.log(`➡️ Migrating user ${user._id} | lat=${user.lat}, long=${user.long}`);

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              location: {
                type: "Point",
                coordinates: [user.long, user.lat],
              },
            },
          }
        );
        migratedCount++;

        console.log(`✅ User ${user._id} migrated successfully`);
      }
    }

    console.log(`🎉 Migration complete! Migrated ${migratedCount} users.`);

    // Ensure geospatial index exists
    console.log("⚙️ Creating 2dsphere index on location...");
    await User.collection.createIndex({ location: "2dsphere" });
    console.log("✅ 2dsphere index created (or already exists)");

    await mongoose.disconnect();
    console.log("🔌 Disconnected from DB");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateUsers();
