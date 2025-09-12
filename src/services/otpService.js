import axios from "axios";

export const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};


export const sendSms = async (phoneNumber,otpValue) => {

  phoneNumber = phoneNumber.replace("+91", "");
  console.log(phoneNumber, otpValue, "phoneNumber otpValue");
  const smsText = `Your OTP for JK Tyre is ${otpValue}`;
  const url = `http://bulkpush.mytoday.com/BulkSms/SingleMsgApi?feedid=381504&userName=9953995316&password=Welcome@123&to=${phoneNumber}&text=${encodeURIComponent(
    smsText
  )}`;

  try {
    console.log("📤 Sending OTP:", url);
    const response = await axios.get(url);
    console.log("✅ OTP RESPONSE", response.status);
    return response.data;
  } catch (error) {
    console.error("❌ OTP ERROR", error.message);
    throw error;
  }
};


export const sendWhatsAppMessage  =  async (to, text) => {
  try {
    to = to.replace("+91", "");
    const response = await axios.post(
      "https://wasenderapi.com/api/send-message",
      { to, text },
      {
        headers: {
          Authorization: "Bearer 6b937aeabafb56e6268c760ac9ecfea3990e9ebcc28946cfb6e9cead0924fcdd",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Message Sent:", response.data);
  } catch (error) {
    console.error("❌ Error Sending Message:", error.response?.data || error.message);
  }
}