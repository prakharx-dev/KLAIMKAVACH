export default function handler(req, res) {
  res.status(200).json({
    userName: "Gig Worker",
    riskScore: 24,
    riskLevel: "Low Risk",
    weeklyPremium: 49,
    coverageAmount: 25000,
    activePolicies: 1,
    totalClaims: 0,
    lastUpdated: new Date().toISOString()
  });
}
