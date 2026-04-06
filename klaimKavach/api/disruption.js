import "./_env.js";

export default function handler(req, res) {
  res.status(200).json({
    hasDisruption: false,
    type: "None",
    severity: "None",
    message: "Clear skies and normal traffic in your zone.",
    eligibleForClaim: false,
  });
}
