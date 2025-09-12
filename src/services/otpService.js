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