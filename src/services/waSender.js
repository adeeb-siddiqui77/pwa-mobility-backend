// src/services/waSender.js
import axios from "axios";

const BASE = process.env.WASENDER_API_BASE || "https://wasenderapi.com";
const TOKEN = process.env.WASENDER_API_TOKEN;

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Plain text message (always rendered)
export async function sendSimpleMessage({ to, text }) {
  const { data } = await client.post("/api/send-message", { to, text });
  const messageId = data?.messageId || data?.id || data?.messages?.[0]?.id || null;
  return { messageId, raw: data };
}

// Poll message (single-choice buttons)
export async function sendJobPollMessage({ to }) {
  const payload = {
    to,
    poll: {
      question: "Do you accept this job?",
      options: ["Accept", "Reject"],
      multiSelect: false
    }
  };
  const { data } = await client.post("/api/send-message", payload);
  const messageId = data?.msgId || data?.id || data?.messages?.[0]?.id || null;
  return { messageId, raw: data };
}
