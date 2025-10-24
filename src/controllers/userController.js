import axios from 'axios';
import User from '../models/User.js';

/**
 * Get driving distance and duration using Google Maps Routes API
 */
const getDrivingDistance = async (origin, destinations) => {
    const results = [];

    try {
        // Process destinations one by one to get routes
        for (const destination of destinations) {
            try {
                const response = await axios.post(
                    'https://routes.googleapis.com/directions/v2:computeRoutes',
                    {
                        origin: {
                            location: {
                                latLng: {
                                    latitude: origin.lat,
                                    longitude: origin.lng
                                }
                            }
                        },
                        destination: {
                            location: {
                                latLng: {
                                    latitude: destination.lat,
                                    longitude: destination.lng
                                }
                            }
                        },
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_AWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: "METRIC"
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
                        }
                    }
                );

                console.log("Google Maps Routes API response:", response.data);

                if (response.data.routes && response.data.routes[0]) {
                    const route = response.data.routes[0];
                    results.push({
                        distance: route?.distanceMeters ? route.distanceMeters / 1000 : 0, // Convert to kilometers
                        duration: route.duration ? parseInt(route.duration.replace('s', '')) / 60 : null // Convert to minutes
                    });
                } else {
                    results.push({ distance: null, duration: null });
                }
            } catch (error) {
                console.error('Error calculating route:', error);
                results.push({ distance: null, duration: null });
            }
        }

        return results;
    } catch (error) {
        console.error('Error getting driving distances:', error);
        return destinations.map(() => ({ distance: null, duration: null }));
    }
};

/**
 * Find nearest users based on latitude and longitude using MongoDB's geospatial queries
 */
// export const findNearestUsers = async (req, res) => {


//     try {
//         const { latitude, longitude, radius = 50 } = req.query; // radius in kilometers, default 50km

//         if (!latitude || !longitude) {
//             return res.status(400).json({
//                 error: 'Missing coordinates',
//                 message: 'Latitude and longitude are required'
//             });
//         }

//         // Convert string coordinates to numbers
//         const lat = parseFloat(latitude);
//         const lng = parseFloat(longitude);

//         // Find nearest users using MongoDB's $geoNear aggregation
//         const nearestUsers = await User.aggregate([
//             {
//                 $geoNear: {
//                     near: {
//                         type: 'Point',
//                         coordinates: [lng, lat] // MongoDB uses [longitude, latitude] order
//                     },
//                     distanceField: 'distance', // Distance in meters
//                     maxDistance: radius * 1000, // Convert km to meters
//                     spherical: true,
//                     query: { /* Add any additional filters here */ }
//                 }
//             },
//             {
//                 $limit: 5 // Get top 5 nearest users for Google Maps distance calculation
//             },
//             {
//                 $project: {
//                     _id: 1,
//                     fullName: 1,
//                     shopName: 1,
//                     address: 1,
//                     mobile: 1,
//                     location: 1,
//                     distance: 1,
//                     businessDays: 1,
//                     timeFrom: 1,
//                     timeTo: 1
//                 }
//             }
//         ]);

//         console.log("Nearest users from MongoDB:", nearestUsers);

//         if (nearestUsers.length === 0) {
//             return res.json({
//                 message: 'No users found within the specified radius',
//                 users: []
//             });
//         }

//         // Get driving distances using Google Maps API
//         const origin = { lat, lng };
//         const destinations = nearestUsers.map(user => ({ 
//             lat: user.location.coordinates[1], 
//             lng: user.location.coordinates[0]
//         }));

//         console.log("Calculating driving distances from:", origin, "to:", destinations);

//         const drivingDistances = await getDrivingDistance(origin, destinations);

//         console.log("Driving distances from Google Maps:", drivingDistances);

//         // Combine MongoDB and Google Maps data
//         const usersWithDrivingDistance = nearestUsers.map((user, index) => ({
//             _id: user._id,
//             fullName: user.fullName,
//             shopName: user.shopName,
//             address: user.address,
//             mobile: user.mobile,
//             coordinates: {
//                 latitude: user.location.coordinates[1],
//                 longitude: user.location.coordinates[0]
//             },
//             straightLineDistance: Math.round((user.distance / 1000) * 10) / 10, // Convert to km and round to 1 decimal
//             drivingDistance: drivingDistances[index]?.distance,
//             drivingDuration: drivingDistances[index]?.duration,
//             businessDays: user.businessDays,
//             timeFrom: user.timeFrom,
//             timeTo: user.timeTo
//         }));

//         // Sort by driving distance if available, otherwise use straight-line distance
//         const sortedUsers = usersWithDrivingDistance
//             .sort((a, b) => {
//                 const distA = a.drivingDuration? a.drivingDuration : a.drivingDistance
//                 const distB = b.drivingDuration? b.drivingDuration : a.drivingDistance
//                 return distA - distB;
//             })
//             .slice(0, 1); // Return only top 3 nearest users

//         res.json({
//             message: 'Nearest users found successfully',
//             users: sortedUsers
//         });

//     } catch (error) {
//         console.error('Error finding nearest users:', error);
//         res.status(500).json({
//             error: 'Failed to find nearest users',
//             message: error.message
//         });
//     }
// };



// ----------------------------------------- TYRING NEW UPDATED ----------------------------------------


export const findNearestUsers = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius,          // optional, km
      targetCity,      // required when heading not provided
      heading,         // optional, degrees [0..360)
      forwardConeDeg,  // optional, degrees (default 45)
      limit            // optional, how many to return (default 3)
    } = req.query;

    // --- basic validation ---
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Missing coordinates",
        message: "Latitude and longitude are required"
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        error: "Invalid coordinates",
        message: "Latitude/longitude must be valid numbers"
      });
    }

    const RADIUS_KM = Number(radius) > 0 ? Number(radius) : 50; // default 50km
    const FORWARD_CONE_DEG = Number(forwardConeDeg) > 0 ? Number(forwardConeDeg) : 45; // ±45°
    const TOP_N = Number(limit) > 0 ? Number(limit) : 3;

    // --- helpers ---
    const toRad = deg => (deg * Math.PI) / 180;
    const toDeg = rad => (rad * 180) / Math.PI;

    function getBearing(lat1, lon1, lat2, lon2) {
      const dLon = toRad(lon2 - lon1);
      const y = Math.sin(dLon) * Math.cos(toRad(lat2));
      const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
      const brng = toDeg(Math.atan2(y, x));
      return (brng + 360) % 360; // normalize
    }

    function angleDifference(a, b) {
      const diff = Math.abs(a - b) % 360;
      return diff > 180 ? 360 - diff : diff;
    }

    async function getCityCoordinates(cityName) {
      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: { q: cityName, format: "json", limit: 1 },
          headers: { "Accept-Language": "en", "User-Agent": "pitshop-finder/1.0" }
        });
        if (!response.data?.length) return null;
        const { lat, lon } = response.data[0];
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      } catch (e) {
        console.error("Error fetching city coordinates:", e.message);
        return null;
      }
    }

    // --- resolve heading (priority: query.heading -> targetCity bearing) ---
    let userHeading = (heading !== undefined && heading !== null) ? Number(heading) : null;

    if (
      (userHeading === null || Number.isNaN(userHeading)) &&
      (!targetCity || typeof targetCity !== "string" || !targetCity.trim())
    ) {
      return res.status(400).json({
        error: "Missing heading info",
        message:
          "Provide either 'heading' (0–360) or a 'targetCity' to infer direction."
      });
    }

    let targetCoords = null;
    if (userHeading === null) {
      targetCoords = await getCityCoordinates(targetCity);
      if (!targetCoords) {
        return res.status(400).json({
          error: "City not found",
          message: `Could not resolve coordinates for '${targetCity}'.`
        });
      }
      userHeading = getBearing(lat, lng, targetCoords.latitude, targetCoords.longitude);
      console.log(
        `Heading inferred from city '${targetCity}': ${userHeading.toFixed(1)}°`
      );
    } else {
      // ensure normalized
      userHeading = ((userHeading % 360) + 360) % 360;
      console.log(`Heading from client: ${userHeading.toFixed(1)}°`);
    }

    // --- fetch nearby pitshops/users via $geoNear ---
    const nearestUsers = await User.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] }, // [lon, lat]
          distanceField: "distance", // meters
          maxDistance: RADIUS_KM * 1000,
          spherical: true,
          query: {
            // add extra Mongo filters here if needed, e.g., active: true
          }
        }
      },
      { $limit: 30 }, // grab a reasonable set to direction-filter
      {
        $project: {
          _id: 1,
          fullName: 1,
          shopName: 1,
          address: 1,
          mobile: 1,
          location: 1,
          distance: 1,
          businessDays: 1,
          timeFrom: 1,
          timeTo: 1
        }
      }
    ]);

    if (!nearestUsers.length) {
      return res.json({
        message: "No users found within the specified radius",
        users: []
      });
    }

    // --- compute bearing to each candidate and filter by forward cone ---
    const candidates = nearestUsers.map(p => {
      const [pLon, pLat] = p.location.coordinates; // [lon, lat]
      const bearingToPitshop = getBearing(lat, lng, pLat, pLon);
      const diff = angleDifference(userHeading, bearingToPitshop);
      return { ...p, bearingToPitshop, diff };
    });

    const forwardCandidates = candidates.filter(
      c => c.diff <= FORWARD_CONE_DEG
    );

    const directionalSet = forwardCandidates.length ? forwardCandidates : candidates; // fallback if none ahead

    // --- driving distances (best-effort) ---
    let drivingDistances = [];
    try {
      const origin = { lat, lng };
      const destinations = directionalSet.map(u => ({
        lat: u.location.coordinates[1],
        lng: u.location.coordinates[0]
      }));
      drivingDistances = await getDrivingDistance(origin, destinations);
      // expected shape: [{ distance: <meters>, duration: <seconds> }, ...]
    } catch (e) {
      console.warn("getDrivingDistance failed; falling back to straight-line:", e?.message);
    }

    // --- merge + sort by best metric ---
    const usersWithMetrics = directionalSet.map((user, index) => {
      const drive = drivingDistances?.[index] || {};
      const straightKm = Math.round((user.distance / 1000) * 10) / 10;
      return {
        _id: user._id,
        fullName: user.fullName,
        shopName: user.shopName,
        address: user.address,
        mobile: user.mobile,
        coordinates: {
          latitude: user.location.coordinates[1],
          longitude: user.location.coordinates[0]
        },
        straightLineDistance: straightKm,            // km
        drivingDistance: drive.distance ?? null,     // meters (if provided)
        drivingDuration: drive.duration ?? null,     // seconds (if provided)
        bearingToPitshop: user.bearingToPitshop,     // degrees
        headingUsed: userHeading,                    // degrees
        angleOffHeading: user.diff,                  // degrees
        businessDays: user.businessDays,
        timeFrom: user.timeFrom,
        timeTo: user.timeTo
      };
    });

    // sort by (duration -> distance -> straight-line)
    const sorted = usersWithMetrics
      .sort((a, b) => {
        const aMetric =
          (a.drivingDuration ?? null) !== null
            ? a.drivingDuration
            : (a.drivingDistance ?? null) !== null
              ? a.drivingDistance
              : a.straightLineDistance; // km
        const bMetric =
          (b.drivingDuration ?? null) !== null
            ? b.drivingDuration
            : (b.drivingDistance ?? null) !== null
              ? b.drivingDistance
              : b.straightLineDistance; // km
        return aMetric - bMetric;
      })
      .slice(0, TOP_N);


    console.log("Final Pitshops : " , sorted)

    return res.json({
      message:
        forwardCandidates.length
          ? `Nearest users ahead within ±${FORWARD_CONE_DEG}°`
          : "No ahead candidates; returning overall nearest instead",
      users: sorted
    });
  } catch (error) {
    console.error("Error finding nearest users:", error);
    return res.status(500).json({
      error: "Failed to find nearest users",
      message: error.message
    });
  }
};
