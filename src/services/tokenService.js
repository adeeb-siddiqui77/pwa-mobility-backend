import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const isTokenValid = (tokenDetails) => {
    return tokenDetails.accessToken && tokenDetails.expiresAt && Date.now() < tokenDetails.expiresAt;
};


const getValidAccessToken = async (tokenDetails) => {
    console.log("Checking token validity:", tokenDetails);
    if (isTokenValid(tokenDetails)) {
        return tokenDetails;
    }
    return await generateAccessToken(tokenDetails);
};


const generateAccessToken = async (tokenDetails) => {
    try {
        console.log("Generating new access token using refresh token");
        const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: {
                refresh_token: process.env.ZOHO_REFRESH_TOKEN,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token',
                scope : process.env.SCOPE,
                redirect_uri: process.env.REDIRECT_URI
            }
        });
        console.log("New access token response:", response.data);

        tokenDetails.accessToken = response.data.access_token;
        // Zoho tokens typically expire in 1 hour (3600 seconds)
        tokenDetails.expiresAt = Date.now() + (response.data.expires_in * 1000);
        return tokenDetails;
    } catch (error) {
        console.error('Error generating access token:', error);
        throw new Error('Failed to generate access token');
    }
};

export {
    getValidAccessToken,
    generateAccessToken,
    isTokenValid
};
