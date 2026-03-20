export default function handler(req, res) {
  res.status(200).json({
    trustScore: 98,
    status: "Excellent",
    label: "Verified",
    details: "No anomalous patterns detected in recent activity."
  });
}
