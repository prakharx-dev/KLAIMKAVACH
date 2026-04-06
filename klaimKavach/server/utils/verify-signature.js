import crypto from "crypto";

export function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  keySecret,
}) {
  const normalizedOrderId = String(razorpayOrderId ?? "").trim();
  const normalizedPaymentId = String(razorpayPaymentId ?? "").trim();
  const normalizedSignature = String(razorpaySignature ?? "")
    .trim()
    .toLowerCase();
  const body = `${normalizedOrderId}|${normalizedPaymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === normalizedSignature;
}
