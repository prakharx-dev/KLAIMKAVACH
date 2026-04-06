import { razorpayClient } from "../config/razorpay.js";
import { verifyRazorpaySignature } from "../utils/verify-signature.js";

export function getPaymentConfig(_req, res) {
  const keyId = process.env.RAZORPAY_KEY_ID;

  if (!keyId) {
    res.status(500).json({
      success: false,
      message: "Missing RAZORPAY_KEY_ID in backend environment.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    keyId,
  });
}

function parseInrAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100);
}

export async function createOrder(req, res) {
  try {
    const amountInPaise = parseInrAmount(req.body?.amount);

    if (!amountInPaise) {
      res.status(400).json({
        success: false,
        message: "Invalid amount. Send amount in INR as a positive number.",
      });
      return;
    }

    const order = await razorpayClient.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({
      success: false,
      message: `Failed to create Razorpay order. ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body ?? {};
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      res.status(500).json({
        success: false,
        message: "Missing RAZORPAY_KEY_SECRET in backend environment.",
      });
      return;
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        success: false,
        message: "Missing payment verification fields.",
      });
      return;
    }

    const isValid = verifyRazorpaySignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      keySecret,
    });

    res.status(200).json({ success: isValid });
  } catch {
    res.status(500).json({ success: false });
  }
}
