function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPrivateIp(ipAddress) {
  if (!ipAddress) return true;
  if (ipAddress === "::1") return true;

  if (ipAddress.includes(".")) {
    const parts = ipAddress.split(".").map((part) => Number(part));
    if (
      parts.length !== 4 ||
      parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
    ) {
      return true;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  const lowered = ipAddress.toLowerCase();
  return lowered.startsWith("fc") || lowered.startsWith("fd");
}

function simpleHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isValidCoordinate(value, min, max) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isLikelyInIndia(latitude, longitude) {
  return latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
}

function calculateTrustScore({ latitude, longitude, ipAddress }) {
  let score = 50;
  const hasLocation =
    isValidCoordinate(latitude, -90, 90) &&
    isValidCoordinate(longitude, -180, 180);
  const hasPublicIp = !!ipAddress && !isPrivateIp(ipAddress);

  if (hasLocation) {
    score += isLikelyInIndia(latitude, longitude) ? 18 : -10;
    const locationFingerprint = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    score += simpleHash(locationFingerprint) % 12;
  } else {
    score -= 12;
  }

  if (hasPublicIp) {
    score += 10 + (simpleHash(ipAddress) % 10);
  } else {
    score -= 14;
  }

  const trustScore = clamp(Math.round(score), 0, 100);

  if (trustScore > 75) {
    return {
      trustScore,
      status: "Excellent",
      label: "Verified",
      details:
        "Location and network signals look trustworthy. Claims are eligible for fast-track verification.",
    };
  }

  if (trustScore >= 45) {
    return {
      trustScore,
      status: "Moderate",
      label: "Needs Review",
      details:
        "Some trust signals are weak or incomplete. Additional checks may be required for high-value claims.",
    };
  }

  return {
    trustScore,
    status: "High Risk",
    label: "Suspicious",
    details:
      "Trust signals are low due to inconsistent location or IP data. Manual fraud screening is recommended.",
  };
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const latitude =
    typeof body.latitude === "number" ? body.latitude : undefined;
  const longitude =
    typeof body.longitude === "number" ? body.longitude : undefined;
  const ipAddress =
    typeof body.ipAddress === "string" ? body.ipAddress.trim() : undefined;

  const result = calculateTrustScore({ latitude, longitude, ipAddress });
  res.status(200).json(result);
}
