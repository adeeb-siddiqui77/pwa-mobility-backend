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
  const { data } = await client.post("/api/send-message", { to, text });
  const messageId = data?.data?.msgId || null;
  return { messageId, raw: data };
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