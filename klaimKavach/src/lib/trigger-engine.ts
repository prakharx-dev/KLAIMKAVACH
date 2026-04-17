/**
 * ─── Parametric Trigger Engine ──────────────────────────────────────────────────
 *
 * Defines parametric trigger thresholds for zero-touch insurance.
 * When environmental conditions breach these thresholds, claims are
 * automatically filed without any manual intervention.
 *
 * This is the core of "parametric insurance" — payout is triggered by
 * measurable events, not subjective damage assessment.
 */

import type { WeatherData } from "@/hooks/use-weather";
import type { TrafficData } from "@/hooks/use-traffic";

// ─── Trigger Definitions ────────────────────────────────────────────────────────

export type TriggerCategory = "rain" | "aqi" | "traffic" | "composite" | "flood" | "seismic";

export interface TriggerRule {
  id: string;
  category: TriggerCategory;
  label: string;
  description: string;
  /** Minimum value to activate */
  threshold: number;
  /** How the value is described */
  unit: string;
  /** Minimum sustained duration in minutes before auto-claim */
  sustainedMinutes: number;
  /** Cooldown after a triggered claim (in hours) */
  cooldownHours: number;
  /** Severity multiplier for payout calculation */
  severityMultiplier: number;
}

export const TRIGGER_RULES: TriggerRule[] = [
  {
    id: "rain_heavy",
    category: "rain",
    label: "Heavy Rainfall",
    description: "Rainfall exceeds safe working threshold",
    threshold: 7.5, // mm/hr
    unit: "mm/hr",
    sustainedMinutes: 10,
    cooldownHours: 4,
    severityMultiplier: 1.0,
  },
  {
    id: "rain_extreme",
    category: "rain",
    label: "Extreme Rainfall",
    description: "Torrential rain — unsafe for any outdoor work",
    threshold: 30,
    unit: "mm/hr",
    sustainedMinutes: 5,
    cooldownHours: 2,
    severityMultiplier: 1.5,
  },
  {
    id: "aqi_poor",
    category: "aqi",
    label: "Poor Air Quality",
    description: "AQI exceeds safe exposure limits",
    threshold: 300,
    unit: "AQI",
    sustainedMinutes: 15,
    cooldownHours: 6,
    severityMultiplier: 0.8,
  },
  {
    id: "aqi_severe",
    category: "aqi",
    label: "Severe Air Quality",
    description: "Hazardous air — respiratory risk",
    threshold: 400,
    unit: "AQI",
    sustainedMinutes: 10,
    cooldownHours: 4,
    severityMultiplier: 1.2,
  },
  {
    id: "traffic_heavy",
    category: "traffic",
    label: "Heavy Traffic",
    description: "Congestion makes deliveries unviable",
    threshold: 60,
    unit: "% congestion",
    sustainedMinutes: 15,
    cooldownHours: 3,
    severityMultiplier: 0.9,
  },
  {
    id: "traffic_gridlock",
    category: "traffic",
    label: "Gridlock",
    description: "Complete traffic standstill",
    threshold: 80,
    unit: "% congestion",
    sustainedMinutes: 10,
    cooldownHours: 2,
    severityMultiplier: 1.3,
  },
  {
    id: "composite_multi",
    category: "composite",
    label: "Multi-Hazard",
    description: "Multiple triggers active simultaneously",
    threshold: 2, // number of active triggers
    unit: "active triggers",
    sustainedMinutes: 5,
    cooldownHours: 2,
    severityMultiplier: 1.4,
  },
];

// ─── Trigger Evaluation ─────────────────────────────────────────────────────────

export interface ActiveTrigger {
  rule: TriggerRule;
  currentValue: number;
  breachAmount: number; // how far above threshold
  severity: "moderate" | "high" | "extreme";
  timestamp: Date;
}

export interface TriggerEvaluation {
  triggers: ActiveTrigger[];
  isBreached: boolean;
  highestSeverity: "none" | "moderate" | "high" | "extreme";
  compositeScore: number; // 0-100, how severe the combined situation is
  autoClaimEligible: boolean;
  suggestedClaimType: TriggerCategory;
  suggestedHours: number;
}

function getSeverity(
  value: number,
  threshold: number,
): "moderate" | "high" | "extreme" {
  const ratio = value / threshold;
  if (ratio >= 2) return "extreme";
  if (ratio >= 1.3) return "high";
  return "moderate";
}

export function evaluateTriggers(
  weather: WeatherData,
  traffic: TrafficData,
): TriggerEvaluation {
  const activeTriggers: ActiveTrigger[] = [];
  const now = new Date();

  // Check rain triggers
  for (const rule of TRIGGER_RULES.filter((r) => r.category === "rain")) {
    if (weather.rain1h >= rule.threshold) {
      activeTriggers.push({
        rule,
        currentValue: weather.rain1h,
        breachAmount: weather.rain1h - rule.threshold,
        severity: getSeverity(weather.rain1h, rule.threshold),
        timestamp: now,
      });
    }
  }

  // Check AQI triggers
  for (const rule of TRIGGER_RULES.filter((r) => r.category === "aqi")) {
    if (weather.aqi >= rule.threshold) {
      activeTriggers.push({
        rule,
        currentValue: weather.aqi,
        breachAmount: weather.aqi - rule.threshold,
        severity: getSeverity(weather.aqi, rule.threshold),
        timestamp: now,
      });
    }
  }

  // Check traffic triggers
  for (const rule of TRIGGER_RULES.filter((r) => r.category === "traffic")) {
    if (traffic.congestionLevel >= rule.threshold) {
      activeTriggers.push({
        rule,
        currentValue: traffic.congestionLevel,
        breachAmount: traffic.congestionLevel - rule.threshold,
        severity: getSeverity(traffic.congestionLevel, rule.threshold),
        timestamp: now,
      });
    }
  }

  // Check composite trigger
  const uniqueCategories = new Set(activeTriggers.map((t) => t.rule.category));
  const compositeRule = TRIGGER_RULES.find((r) => r.id === "composite_multi")!;
  if (uniqueCategories.size >= compositeRule.threshold) {
    activeTriggers.push({
      rule: compositeRule,
      currentValue: uniqueCategories.size,
      breachAmount: uniqueCategories.size - compositeRule.threshold,
      severity: uniqueCategories.size >= 3 ? "extreme" : "high",
      timestamp: now,
    });
  }

  const isBreached = activeTriggers.length > 0;

  const highestSeverity: TriggerEvaluation["highestSeverity"] = !isBreached
    ? "none"
    : activeTriggers.some((t) => t.severity === "extreme")
      ? "extreme"
      : activeTriggers.some((t) => t.severity === "high")
        ? "high"
        : "moderate";

  // Composite score: weighted sum of all breaches
  const compositeScore = Math.min(
    100,
    activeTriggers.reduce((sum, t) => {
      const normalizedBreach = Math.min(1, t.breachAmount / t.rule.threshold);
      return sum + normalizedBreach * t.rule.severityMultiplier * 25;
    }, 0),
  );

  // Suggest claim type based on highest severity trigger
  const suggestedClaimType: TriggerCategory = activeTriggers.length > 0
    ? activeTriggers.sort(
        (a, b) =>
          b.breachAmount * b.rule.severityMultiplier -
          a.breachAmount * a.rule.severityMultiplier,
      )[0].rule.category
    : "composite";

  // Suggest hours based on severity
  const suggestedHours =
    highestSeverity === "extreme"
      ? 4
      : highestSeverity === "high"
        ? 3
        : highestSeverity === "moderate"
          ? 2
          : 1;

  return {
    triggers: activeTriggers,
    isBreached,
    highestSeverity,
    compositeScore: Math.round(compositeScore),
    autoClaimEligible: isBreached && compositeScore >= 15,
    suggestedClaimType,
    suggestedHours,
  };
}

// ─── Cooldown Management ────────────────────────────────────────────────────────

const COOLDOWN_KEY = "klaimkavach_trigger_cooldowns";

interface CooldownRecord {
  ruleId: string;
  triggeredAt: number; // epoch ms
  cooldownUntil: number; // epoch ms
}

function getCooldowns(): CooldownRecord[] {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return [];
    const records = JSON.parse(raw) as CooldownRecord[];
    // Purge expired cooldowns
    const now = Date.now();
    return records.filter((r) => r.cooldownUntil > now);
  } catch {
    return [];
  }
}

function setCooldown(ruleId: string, cooldownHours: number): void {
  const cooldowns = getCooldowns();
  cooldowns.push({
    ruleId,
    triggeredAt: Date.now(),
    cooldownUntil: Date.now() + cooldownHours * 60 * 60 * 1000,
  });
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
}

export function isOnCooldown(ruleId: string): boolean {
  return getCooldowns().some((r) => r.ruleId === ruleId);
}

export function getTriggersNotOnCooldown(
  triggers: ActiveTrigger[],
): ActiveTrigger[] {
  return triggers.filter((t) => !isOnCooldown(t.rule.id));
}

export function markTriggerFired(trigger: ActiveTrigger): void {
  setCooldown(trigger.rule.id, trigger.rule.cooldownHours);
}

// ─── Trigger Event Log ──────────────────────────────────────────────────────────

const EVENT_LOG_KEY = "klaimkavach_trigger_log";
const MAX_LOG_ENTRIES = 50;

export interface TriggerLogEntry {
  id: string;
  ruleId: string;
  ruleLabel: string;
  category: TriggerCategory;
  currentValue: number;
  threshold: number;
  severity: string;
  claimFiled: boolean;
  claimId?: string;
  timestamp: number;
}

export function addTriggerLogEntry(
  entry: Omit<TriggerLogEntry, "id">,
): void {
  try {
    const raw = localStorage.getItem(EVENT_LOG_KEY);
    const log: TriggerLogEntry[] = raw ? JSON.parse(raw) : [];
    log.unshift({
      ...entry,
      id: `trig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    });
    localStorage.setItem(
      EVENT_LOG_KEY,
      JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)),
    );
  } catch {
    // Fail silently
  }
}

export function getTriggerLog(): TriggerLogEntry[] {
  try {
    const raw = localStorage.getItem(EVENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
