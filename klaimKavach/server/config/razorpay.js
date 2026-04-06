import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

if (!keyId || !keySecret) {
  console.error("⚠️ WARNING: Missing Razorpay credentials in environment. Payments will fail.");
}

export const razorpayClient = keyId && keySecret 
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;
