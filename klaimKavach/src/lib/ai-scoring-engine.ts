export type IpType = "Genuine" | "Slight mismatch" | "Suspicious";
export type TriggerType = "Traffic Jam" | "Heavy Rain" | "Poor AQI";
export type ConsistencyLevel = "Low" | "Medium" | "High";

export interface AIScoringInput {
  location?: unknown;
  ipType: IpType;
  speed: number;
  trigger: TriggerType;
  hours: number;
  pastClaims: number;
  approvalRate: number;
  fraudFlags: number;
  consistency: ConsistencyLevel;
}

export type ClaimDecision = "Approved" | "Pending" | "Flagged";
export type SystemConfidence = "High" | "Medium" | "Low";

export interface AIScoringOutput {
  riskScore: number;
  trustScore: number;
  finalScore: number;
  decision: ClaimDecision;
  fraudConfidence: number;
  systemConfidence: SystemConfidence;
  payoutEstimate: number;
  reasons: string[];
}

interface HardOverrideResult {
  active: boolean;
  gapKm: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax <= inMin) return outMin;
  const normalized = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + normalized * (outMax - outMin);
}

function addChange(
  reasons: string[],
  score: number,
  delta: number,
  positiveReason: string,
  negativeReason: string,
): number {
  if (delta === 0) return score;
  reasons.push(
    `${delta > 0 ? positiveReason : negativeReason} (${delta > 0 ? `+${delta}` : delta})`,
  );
  return score + delta;
}

function getIpGpsGapKm(location: unknown): number | null {
  if (!location || typeof location !== "object") return null;

  const source = location as Record<string, unknown>;
  const candidates = [
    source.ipGpsGapKm,
    source.gpsIpGapKm,
    source.gapKm,
    source.distanceKm,
    source.ipGpsDistanceKm,
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) {
      return Math.round(num);
    }
  }

  return null;
}

function detectHardOverride(input: AIScoringInput): HardOverrideResult {
  const gapKm = getIpGpsGapKm(input.location);
  const massiveGapDetected = gapKm !== null && gapKm >= 500;
  const active = input.ipType === "Suspicious" && massiveGapDetected;

  return { active, gapKm };
}

function computeRiskScore(input: AIScoringInput, reasons: string[]): number {
  let riskScore = 100;

  if (input.ipType === "Slight mismatch") {
    riskScore = addChange(
      reasons,
      riskScore,
      -20,
      "IP check improved",
      "Slight IP mismatch detected",
    );
  } else if (input.ipType === "Suspicious") {
    riskScore = addChange(
      reasons,
      riskScore,
      -50,
      "IP check improved",
      "Suspicious IP detected",
    );
  }

  if (input.trigger === "Traffic Jam" && input.speed > 80) {
    riskScore = addChange(
      reasons,
      riskScore,
      -30,
      "Speed behavior normal for traffic",
      "High speed anomaly during traffic detected",
    );
  }

  if (input.trigger !== "Traffic Jam" && input.speed > 0) {
    riskScore = addChange(
      reasons,
      riskScore,
      -20,
      "No movement during non-traffic trigger",
      "Unexpected movement during non-traffic trigger",
    );
  }

  if (input.trigger === "Traffic Jam") {
    riskScore = addChange(
      reasons,
      riskScore,
      15,
      "Traffic trigger validated",
      "Traffic trigger not validated",
    );
  } else if (input.trigger === "Heavy Rain") {
    riskScore = addChange(
      reasons,
      riskScore,
      20,
      "Heavy rain trigger validated",
      "Rain trigger not validated",
    );
  } else if (input.trigger === "Poor AQI") {
    riskScore = addChange(
      reasons,
      riskScore,
      10,
      "Poor AQI trigger validated",
      "AQI trigger not validated",
    );
  }

  if (input.hours >= 2 && input.hours <= 6) {
    riskScore = addChange(
      reasons,
      riskScore,
      10,
      "Moderate work-hour disruption validated",
      "Work-hour validation penalty",
    );
  } else if (input.hours > 10) {
    riskScore = addChange(
      reasons,
      riskScore,
      -15,
      "Work-hour profile stable",
      "Excessive hour loss pattern detected",
    );
  }

  return clamp(Math.round(riskScore), 0, 100);
}

function computeTrustScore(input: AIScoringInput, reasons: string[]): number {
  let trustScore = 50;

  if (input.approvalRate > 80) {
    trustScore = addChange(
      reasons,
      trustScore,
      30,
      "High approval rate",
      "Approval-rate penalty",
    );
  } else if (input.approvalRate > 50 && input.approvalRate <= 80) {
    trustScore = addChange(
      reasons,
      trustScore,
      15,
      "Moderate approval rate",
      "Approval-rate penalty",
    );
  } else if (input.approvalRate < 50) {
    trustScore = addChange(
      reasons,
      trustScore,
      -20,
      "Approval-rate boost",
      "Low approval rate",
    );
  }

  if (input.fraudFlags === 0) {
    trustScore = addChange(
      reasons,
      trustScore,
      20,
      "No fraud flags",
      "Fraud-flag penalty",
    );
  } else if (input.fraudFlags === 1) {
    trustScore = addChange(
      reasons,
      trustScore,
      -20,
      "Fraud-flag recovery",
      "Single fraud flag found",
    );
  } else if (input.fraudFlags >= 2) {
    trustScore = addChange(
      reasons,
      trustScore,
      -40,
      "Fraud-flag recovery",
      "Multiple fraud flags found",
    );
  }

  if (input.pastClaims > 10) {
    trustScore = addChange(
      reasons,
      trustScore,
      -15,
      "Claim frequency stable",
      "High claim frequency detected",
    );
  }

  if (input.consistency === "High") {
    trustScore = addChange(
      reasons,
      trustScore,
      20,
      "High behavioral consistency",
      "Consistency penalty",
    );
  } else if (input.consistency === "Medium") {
    trustScore = addChange(
      reasons,
      trustScore,
      10,
      "Medium behavioral consistency",
      "Consistency penalty",
    );
  } else if (input.consistency === "Low") {
    trustScore = addChange(
      reasons,
      trustScore,
      -15,
      "Consistency recovered",
      "Low behavioral consistency",
    );
  }

  return clamp(Math.round(trustScore), 0, 100);
}

function deriveDecision(
  input: AIScoringInput,
  riskScore: number,
  trustScore: number,
  finalScore: number,
  hardOverride: HardOverrideResult,
  reasons: string[],
): ClaimDecision {
  if (hardOverride.active) {
    reasons.push(
      `Hard Override: IP/GPS location mismatch detected: ${hardOverride.gapKm}km gap (claim auto-flagged)`,
    );
    return "Flagged";
  }

  const majorFraudSignalDetected =
    input.ipType === "Suspicious" ||
    input.fraudFlags >= 2 ||
    input.consistency === "Low" ||
    riskScore < 35;

  if (majorFraudSignalDetected) {
    reasons.push("Major fraud signal detected: claim moved to Flagged/Blocked");
    return "Flagged";
  }

  if (finalScore < 50) {
    reasons.push("Final score below 50: claim moved to Flagged/Blocked");
    return "Flagged";
  }

  if (finalScore > 75) {
    const telemetryGenuine =
      input.ipType === "Genuine" && input.consistency !== "Low";
    const decentTrustHistory =
      trustScore >= 60 && input.approvalRate >= 60 && input.fraudFlags === 0;

    if (telemetryGenuine && decentTrustHistory) {
      reasons.push(
        "Auto Approve gate passed: telemetry genuine and trust history healthy",
      );
      return "Approved";
    }

    reasons.push(
      "Auto Approve gate failed: high score but telemetry/trust conditions were mixed (moved to Pending L2 Review)",
    );
    return "Pending";
  }

  reasons.push("Score in 50-75 range: moved to Pending L2 Review");
  return "Pending";
}

function deriveSystemConfidence(finalScore: number): SystemConfidence {
  if (finalScore > 75) return "High";
  if (finalScore >= 50) return "Medium";
  return "Low";
}

function derivePayoutEstimate(
  decision: ClaimDecision,
  finalScore: number,
): number {
  if (decision === "Approved") {
    return Math.round(mapRange(finalScore, 76, 100, 100, 150));
  }

  if (decision === "Pending") {
    return Math.round(mapRange(finalScore, 50, 75, 50, 80));
  }

  return 0;
}

export function computeAIScoring(input: AIScoringInput): AIScoringOutput {
  const sanitizedInput: AIScoringInput = {
    ...input,
    speed: clamp(Number(input.speed), 0, 120),
    hours: clamp(Number(input.hours), 0, 12),
    pastClaims: clamp(Math.round(Number(input.pastClaims)), 0, 20),
    approvalRate: clamp(Number(input.approvalRate), 0, 100),
    fraudFlags: Math.max(0, Math.round(Number(input.fraudFlags))),
  };

  const reasons: string[] = [];
  const hardOverride = detectHardOverride(sanitizedInput);

  const riskScore = computeRiskScore(sanitizedInput, reasons);
  const trustScore = computeTrustScore(sanitizedInput, reasons);
  const finalScore = round(0.6 * riskScore + 0.4 * trustScore, 2);
  reasons.push(
    `Final Score = (Risk ${riskScore} x 0.6) + (Trust ${trustScore} x 0.4) = ${finalScore}`,
  );
  reasons.push(
    "Decision policy: Auto Approve >75, Pending L2 Review 50-75, Flagged/Blocked <50",
  );

  const decision = deriveDecision(
    sanitizedInput,
    riskScore,
    trustScore,
    finalScore,
    hardOverride,
    reasons,
  );

  const fraudConfidence = round(clamp(100 - finalScore, 0, 100), 2);
  const systemConfidence = deriveSystemConfidence(finalScore);
  const payoutEstimate = derivePayoutEstimate(decision, finalScore);

  return {
    riskScore,
    trustScore,
    finalScore,
    decision,
    fraudConfidence,
    systemConfidence,
    payoutEstimate,
    reasons,
  };
}

export default computeAIScoring;
