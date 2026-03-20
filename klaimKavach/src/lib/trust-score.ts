export interface TrustScoreInput {
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
}

export interface TrustScoreBreakdown {
  score: number;
  status: string;
  label: string;
  details: string;
}

interface TrustScoreApiResponse {
  trustScore: number;
  status: string;
  label: string;
  details: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isValidLatitude(value?: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(value?: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function isPrivateIp(ipAddress?: string): boolean {
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

  return (
    ipAddress.toLowerCase().startsWith("fc") ||
    ipAddress.toLowerCase().startsWith("fd")
  );
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isLikelyInIndia(latitude: number, longitude: number): boolean {
  return latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
}

export function calculateTrustScore(
  input: TrustScoreInput,
): TrustScoreBreakdown {
  let score = 50;
  const hasLocation =
    isValidLatitude(input.latitude) && isValidLongitude(input.longitude);
  const hasPublicIp = !!input.ipAddress && !isPrivateIp(input.ipAddress);

  if (hasLocation) {
    const latitude = input.latitude as number;
    const longitude = input.longitude as number;

    score += isLikelyInIndia(latitude, longitude) ? 18 : -10;

    const locationFingerprint = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    score += simpleHash(locationFingerprint) % 12;
  } else {
    score -= 12;
  }

  if (hasPublicIp) {
    const ipFingerprint = input.ipAddress as string;
    score += 10 + (simpleHash(ipFingerprint) % 10);
  } else {
    score -= 14;
  }

  const finalScore = clamp(Math.round(score), 0, 100);

  if (finalScore > 75) {
    return {
      score: finalScore,
      status: "Excellent",
      label: "Verified",
      details:
        "Location and network signals look trustworthy. Claims are eligible for fast-track verification.",
    };
  }

  if (finalScore >= 45) {
    return {
      score: finalScore,
      status: "Moderate",
      label: "Needs Review",
      details:
        "Some trust signals are weak or incomplete. Additional checks may be required for high-value claims.",
    };
  }

  return {
    score: finalScore,
    status: "High Risk",
    label: "Suspicious",
    details:
      "Trust signals are low due to inconsistent location or IP data. Manual fraud screening is recommended.",
  };
}

export async function fetchTrustScoreFromApi(
  input: TrustScoreInput,
): Promise<TrustScoreBreakdown | undefined> {
  try {
    const response = await fetch("/api/fraud", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) return undefined;

    const data = (await response.json()) as TrustScoreApiResponse;
    if (
      typeof data.trustScore !== "number" ||
      typeof data.status !== "string" ||
      typeof data.label !== "string" ||
      typeof data.details !== "string"
    ) {
      return undefined;
    }

    return {
      score: clamp(Math.round(data.trustScore), 0, 100),
      status: data.status,
      label: data.label,
      details: data.details,
    };
  } catch {
    return undefined;
  }
}

export async function getPublicIpAddress(): Promise<string | undefined> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) return undefined;

    const data = (await response.json()) as { ip?: string };
    if (!data.ip || typeof data.ip !== "string") return undefined;

    return data.ip;
  } catch {
    return undefined;
  }
}

export async function getCurrentCoordinates(): Promise<{
  latitude?: number;
  longitude?: number;
}> {
  if (typeof window === "undefined" || !window.navigator.geolocation) {
    return {};
  }

  return new Promise((resolve) => {
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve({}),
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60_000,
      },
    );
  });
}
