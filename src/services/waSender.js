// src/services/waSender.js
import axios from "axios";

const BASE = process.env.WASENDER_API_BASE || "https://wasenderapi.com";
const TOKEN = process.env.WASENDER_API_TOKEN;

const client = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
});




// Plain text message (always rendered)
export async function sendSimpleMessage({ to, text }) {
  try {
    const { data } = await client.post("/api/send-message", { to, text });

    const messageId = data?.data?.msgId || null;

    return {
      messageId,
      raw: data,
    };

  } catch (error) {
    console.error("sendSimpleMessage error:", error?.response?.data || error);

    return {
      success: false,
      messageId: null,
      error: error?.response?.data || error?.message || "Unknown error",
    };
  }
}

export async function sendJobPollMessage({ to, question = "Do you accept this job?" }) {
  const payload = {
    to,
    poll: {
      question,
      options: ["Accept", "Reject"],
      multiSelect: false
    }
  };
  const { data } = await client.post("/api/send-message", payload);
  const messageId = data?.data?.msgId || data?.id || data?.messages?.[0]?.id || null;
  return { messageId, raw: data };
}


// Send WhatsApp Location
export async function sendLocationMessage({ to, latitude, longitude, name }) {
  const payload = {
    to,
    location: {
      latitude: Number(latitude),
      longitude: Number(longitude),
      name
    }
  };

  console.log("📍 Sending location message to:", to);
  console.log("📍 Location:", { latitude, longitude, name });
  console.log("📍 Payload:", payload);

  try {
    const { data } = await client.post("/api/send-message", payload);

    console.log("✅ Location message sent:", data);

    const messageId = data?.data?.msgId || null;
    return { messageId, raw: data };
  } catch (err) {
    console.error("❌ Error sending location message:");
    console.error(err.response?.data || err.message);
  }
}

