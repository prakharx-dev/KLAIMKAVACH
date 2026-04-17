/**
 * ─── ML Training Data Generator ────────────────────────────────────────────────
 * Generates synthetic labeled data for the fraud-detection neural network.
 *
 * Features (12):
 *   0  rainIntensity    – mm/hr normalized   (0..1)
 *   1  aqiLevel         – AQI / 500          (0..1)
 *   2  trafficCong      – congestion %       (0..1)
 *   3  speed            – km/h / 120         (0..1)
 *   4  pastClaims       – count / 20         (0..1)
 *   5  approvalRate     – % / 100            (0..1)
 *   6  fraudFlags       – count / 5          (0..1)
 *   7  consistency      – 0 | 0.5 | 1        (Low | Med | High)
 *   8  locationScore    – 0..1               (GPS validity)
 *   9  ipScore          – 0..1               (IP legitimacy)
 *  10  hoursClaimed     – hours / 12         (0..1)
 *  11  timeSinceLastClaim – hours / 168 (week) (0..1)
 *
 * Label: 0 = legitimate, 1 = fraud
 */

export interface TrainingSample {
  features: number[];
  label: number; // 0 = legit, 1 = fraud
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function coinFlip(probability = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Generate a single legitimate claim sample.
 * Legitimate claims tend to have:
 * - High approval rate, zero fraud flags, high consistency
 * - Weather-correlated triggers (rain > 0 when claiming rain)
 * - Reasonable hours (1 – 6)
 * - Decent time gap between claims
 * - Valid location & genuine IP
 */
function generateLegitimate(): TrainingSample {
  const rain = coinFlip(0.6) ? rand(2, 30) : rand(0, 1);
  const aqi = coinFlip(0.3) ? rand(200, 450) : rand(20, 150);
  const traffic = coinFlip(0.4) ? rand(40, 85) : rand(5, 35);
  const speed = traffic > 50 ? rand(0, 20) : rand(20, 80);
  const pastClaims = Math.floor(rand(0, 8));
  const approvalRate = rand(65, 100);
  const fraudFlags = 0;
  const consistency = coinFlip(0.7) ? 1 : 0.5;
  const locationScore = rand(0.7, 1.0);
  const ipScore = rand(0.75, 1.0);
  const hoursClaimed = rand(1, 6);
  const timeSinceLast = rand(24, 168);

  return {
    features: [
      clamp01(rain / 50),
      clamp01(aqi / 500),
      clamp01(traffic / 100),
      clamp01(speed / 120),
      clamp01(pastClaims / 20),
      clamp01(approvalRate / 100),
      clamp01(fraudFlags / 5),
      consistency,
      clamp01(locationScore),
      clamp01(ipScore),
      clamp01(hoursClaimed / 12),
      clamp01(timeSinceLast / 168),
    ],
    label: 0,
  };
}

/**
 * Generate a single fraudulent claim sample.
 * Fraud patterns include:
 * - GPS spoofing (low location score)
 * - Excessive hours claimed
 * - Rapid-fire claims (short time since last)
 * - IP mismatch (low ipScore)
 * - Claiming during good weather
 * - Low approval rate / high fraud flags
 */
function generateFraud(): TrainingSample {
  // Pick a fraud archetype
  const archetype = Math.floor(rand(0, 5));

  let rain: number;
  let aqi: number;
  let traffic: number;
  let speed: number;
  let pastClaims: number;
  let approvalRate: number;
  let fraudFlags: number;
  let consistency: number;
  let locationScore: number;
  let ipScore: number;
  let hoursClaimed: number;
  let timeSinceLast: number;

  switch (archetype) {
    case 0: // GPS spoofer — fake location
      rain = rand(0, 5);
      aqi = rand(20, 100);
      traffic = rand(5, 25);
      speed = rand(0, 10);
      pastClaims = Math.floor(rand(3, 15));
      approvalRate = rand(30, 60);
      fraudFlags = Math.floor(rand(1, 4));
      consistency = 0;
      locationScore = rand(0, 0.3);
      ipScore = rand(0.2, 0.5);
      hoursClaimed = rand(5, 12);
      timeSinceLast = rand(1, 12);
      break;

    case 1: // Rapid-fire claimer — many claims, short gaps
      rain = rand(1, 15);
      aqi = rand(50, 200);
      traffic = rand(10, 50);
      speed = rand(10, 60);
      pastClaims = Math.floor(rand(10, 20));
      approvalRate = rand(20, 50);
      fraudFlags = Math.floor(rand(2, 5));
      consistency = 0;
      locationScore = rand(0.3, 0.6);
      ipScore = rand(0.4, 0.7);
      hoursClaimed = rand(6, 12);
      timeSinceLast = rand(0.5, 4);
      break;

    case 2: // Good-weather claimer — no disruption but claiming
      rain = rand(0, 0.5);
      aqi = rand(10, 50);
      traffic = rand(0, 15);
      speed = rand(30, 80);
      pastClaims = Math.floor(rand(2, 10));
      approvalRate = rand(40, 65);
      fraudFlags = Math.floor(rand(0, 3));
      consistency = coinFlip(0.3) ? 0.5 : 0;
      locationScore = rand(0.5, 0.8);
      ipScore = rand(0.5, 0.8);
      hoursClaimed = rand(3, 10);
      timeSinceLast = rand(4, 24);
      break;

    case 3: // IP mismatch — VPN/proxy with location spoof
      rain = coinFlip(0.4) ? rand(5, 25) : rand(0, 3);
      aqi = rand(50, 250);
      traffic = rand(10, 45);
      speed = rand(0, 40);
      pastClaims = Math.floor(rand(4, 12));
      approvalRate = rand(35, 55);
      fraudFlags = Math.floor(rand(1, 4));
      consistency = 0;
      locationScore = rand(0.4, 0.7);
      ipScore = rand(0, 0.25);
      hoursClaimed = rand(4, 10);
      timeSinceLast = rand(2, 16);
      break;

    default: // Excessive hour claimer
      rain = rand(2, 20);
      aqi = rand(100, 300);
      traffic = rand(20, 60);
      speed = rand(0, 30);
      pastClaims = Math.floor(rand(5, 15));
      approvalRate = rand(25, 50);
      fraudFlags = Math.floor(rand(1, 3));
      consistency = coinFlip(0.2) ? 0.5 : 0;
      locationScore = rand(0.3, 0.6);
      ipScore = rand(0.3, 0.6);
      hoursClaimed = rand(8, 12);
      timeSinceLast = rand(1, 8);
      break;
  }

  return {
    features: [
      clamp01(rain / 50),
      clamp01(aqi / 500),
      clamp01(traffic / 100),
      clamp01(speed / 120),
      clamp01(pastClaims / 20),
      clamp01(approvalRate / 100),
      clamp01(fraudFlags / 5),
      consistency,
      clamp01(locationScore),
      clamp01(ipScore),
      clamp01(hoursClaimed / 12),
      clamp01(timeSinceLast / 168),
    ],
    label: 1,
  };
}

/**
 * Generate a balanced training dataset.
 * @param count Total number of samples (split 50/50 legit/fraud).
 */
export function generateTrainingData(count = 400): TrainingSample[] {
  const half = Math.floor(count / 2);
  const samples: TrainingSample[] = [];

  for (let i = 0; i < half; i++) {
    samples.push(generateLegitimate());
  }
  for (let i = 0; i < half; i++) {
    samples.push(generateFraud());
  }

  // Shuffle (Fisher–Yates)
  for (let i = samples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [samples[i], samples[j]] = [samples[j], samples[i]];
  }

  return samples;
}

/** Feature names for explainability */
export const FEATURE_NAMES = [
  "Rain Intensity",
  "AQI Level",
  "Traffic Congestion",
  "Speed",
  "Past Claims",
  "Approval Rate",
  "Fraud Flags",
  "Consistency",
  "Location Score",
  "IP Score",
  "Hours Claimed",
  "Time Since Last Claim",
] as const;

export const NUM_FEATURES = 12;
