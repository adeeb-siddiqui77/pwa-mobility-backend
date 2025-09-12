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
                        distance: route?.distanceMeters ? route.distanceMeters/1000 : 0, // Convert to kilometers
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
export const findNearestUsers = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50 } = req.query; // radius in kilometers, default 50km

        if (!latitude || !longitude) {
            return res.status(400).json({
                error: 'Missing coordinates',
                message: 'Latitude and longitude are required'
            });
        }

        // Convert string coordinates to numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Find nearest users using MongoDB's $geoNear aggregation
        const nearestUsers = await User.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [lng, lat] // MongoDB uses [longitude, latitude] order
                    },
                    distanceField: 'distance', // Distance in meters
                    maxDistance: radius * 1000, // Convert km to meters
                    spherical: true,
                    query: { /* Add any additional filters here */ }
                }
            },
            {
                $limit: 5 // Get top 5 nearest users for Google Maps distance calculation
            },
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

        console.log("Nearest users from MongoDB:", nearestUsers);

        if (nearestUsers.length === 0) {
            return res.json({
                message: 'No users found within the specified radius',
                users: []
            });
        }

        // Get driving distances using Google Maps API
        const origin = { lat, lng };
        const destinations = nearestUsers.map(user => ({ 
            lat: user.location.coordinates[1], 
            lng: user.location.coordinates[0]
        }));

        console.log("Calculating driving distances from:", origin, "to:", destinations);
        
        const drivingDistances = await getDrivingDistance(origin, destinations);

        console.log("Driving distances from Google Maps:", drivingDistances);

        // Combine MongoDB and Google Maps data
        const usersWithDrivingDistance = nearestUsers.map((user, index) => ({
            _id: user._id,
            fullName: user.fullName,
            shopName: user.shopName,
            address: user.address,
            mobile: user.mobile,
            coordinates: {
                latitude: user.location.coordinates[1],
                longitude: user.location.coordinates[0]
            },
            straightLineDistance: Math.round((user.distance / 1000) * 10) / 10, // Convert to km and round to 1 decimal
            drivingDistance: drivingDistances[index]?.distance,
            drivingDuration: drivingDistances[index]?.duration,
            businessDays: user.businessDays,
            timeFrom: user.timeFrom,
            timeTo: user.timeTo
        }));

        // Sort by driving distance if available, otherwise use straight-line distance
        const sortedUsers = usersWithDrivingDistance
            .sort((a, b) => {
                const distA = a.drivingDuration? a.drivingDuration : a.drivingDistance
                const distB = b.drivingDuration? b.drivingDuration : a.drivingDistance
                return distA - distB;
            })
            .slice(0, 1); // Return only top 3 nearest users

        res.json({
            message: 'Nearest users found successfully',
            users: sortedUsers
        });

    } catch (error) {
        console.error('Error finding nearest users:', error);
        res.status(500).json({
            error: 'Failed to find nearest users',
            message: error.message
        });
    }
};