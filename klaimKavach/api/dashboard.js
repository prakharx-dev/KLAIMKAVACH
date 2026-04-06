import "./_env.js";

function buildRealtimeDashboard(userName) {
  const now = Date.now();
  const cycle = Math.sin(now / 20000);
  const riskScore = Math.round(38 + cycle * 18);

  let riskLevel = "Low Risk";
  if (riskScore > 70) {
    riskLevel = "High Risk";
  } else if (riskScore >= 30) {
    riskLevel = "Medium Risk";
  }

  const totalClaims = 1 + Math.floor((now / 45000) % 5);

  return {
    userName,
    riskScore,
    riskLevel,
    weeklyPremium: 49,
    coverageAmount: 25000,
    activePolicies: 1,
    totalClaims,
    lastUpdated: new Date().toISOString(),
  };
}

export default function handler(req, res) {
  let userName = "Gig Worker";
  const cookies = req.headers.cookie;

  if (cookies) {
    const match = cookies.match(/klaimName=([^;]+)/);
    if (match) {
      userName = decodeURIComponent(match[1]);
    }
  }

  res.status(200).json(buildRealtimeDashboard(userName));
}
