export default function handler(req, res) {
  res.status(200).json({
    success: true,
    claimId: "cl_789",
    payoutAmount: 500,
    status: "Approved",
    message: "Claim approved instantly by AI."
  });
}
