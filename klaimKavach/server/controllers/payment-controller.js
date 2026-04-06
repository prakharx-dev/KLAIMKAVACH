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

async function validatePaymentWithRazorpay({ razorpayOrderId, razorpayPaymentId }) {
  if (!razorpayClient) {
    return {
      success: false,
      statusCode: 500,
      message:
        "Razorpay client is not initialized. Check backend Razorpay credentials.",
    };
  }

  const payment = await razorpayClient.payments.fetch(razorpayPaymentId);
  const fetchedOrderId = String(payment?.order_id ?? "");
  const expectedOrderId = String(razorpayOrderId ?? "");
  const paymentStatus = String(payment?.status ?? "").toLowerCase();

  const isValidByApi =
    fetchedOrderId === expectedOrderId &&
    (paymentStatus === "captured" || paymentStatus === "authorized");

  if (!isValidByApi) {
    return {
      success: false,
      statusCode: 400,
      message:
        "Payment verification failed. Order and payment details did not match Razorpay records.",
    };
  }

  return {
    success: true,
    statusCode: 200,
    verifiedBy: "api",
  };
}

export async function createOrder(req, res) {
  try {
    if (!razorpayClient) {
      res.status(500).json({
        success: false,
        message:
          "Razorpay client is not initialized. Check backend Razorpay credentials.",
      });
      return;
    }

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

export async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body ?? {};
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keySecret) {
      res.status(500).json({
        success: false,
        message: "Missing RAZORPAY_KEY_SECRET in backend environment.",
      });
      return;
    }

    if (!razorpay_order_id || !razorpay_payment_id) {
      res.status(400).json({
        success: false,
        message: "Missing payment verification fields (order_id/payment_id).",
      });
      return;
    }

    const hasSignature = typeof razorpay_signature === "string";
    const isValidBySignature =
      hasSignature &&
      verifyRazorpaySignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        keySecret,
      });

    if (isValidBySignature) {
      res.status(200).json({ success: true, verifiedBy: "signature" });
      return;
    }

    const apiValidation = await validatePaymentWithRazorpay({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    if (!apiValidation.success) {
      res.status(apiValidation.statusCode).json({
        success: false,
        message: apiValidation.message,
      });
      return;
    }

    res.status(200).json({ success: true, verifiedBy: apiValidation.verifiedBy });
  } catch (error) {
    console.error("Razorpay Verify Error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected payment verification error.",
    });
  }
}

export async function reconcilePayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id } = req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id) {
      res.status(400).json({
        success: false,
        message: "Missing payment reconciliation fields (order_id/payment_id).",
      });
      return;
    }

    const apiValidation = await validatePaymentWithRazorpay({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    if (!apiValidation.success) {
      res.status(apiValidation.statusCode).json({
        success: false,
        message: apiValidation.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      reconciled: true,
      verifiedBy: apiValidation.verifiedBy,
    });
  } catch (error) {
    console.error("Razorpay Reconcile Error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected payment reconciliation error.",
    });
  }
}
