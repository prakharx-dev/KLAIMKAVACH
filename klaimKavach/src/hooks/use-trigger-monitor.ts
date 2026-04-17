/**
 * ─── Auto Trigger Monitor Hook ──────────────────────────────────────────────────
 *
 * Background monitoring hook that:
 * 1. Polls weather + traffic data every 30 seconds
 * 2. Evaluates parametric triggers against live conditions
 * 3. Auto-files claims when thresholds are breached
 * 4. Manages cooldowns to prevent duplicate claims
 * 5. Maintains a trigger event timeline
 *
 * This is what makes the insurance truly "parametric" and "zero-touch" —
 * the gig worker doesn't need to manually file anything.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import type { WeatherData } from "@/hooks/use-weather";
import type { TrafficData } from "@/hooks/use-traffic";
import {
  evaluateTriggers,
  getTriggersNotOnCooldown,
  markTriggerFired,
  addTriggerLogEntry,
  getTriggerLog,
  type TriggerEvaluation,
  type ActiveTrigger,
  type TriggerLogEntry,
} from "@/lib/trigger-engine";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AutoClaimResult {
  success: boolean;
  claimId?: string;
  payoutAmount?: number;
  status?: string;
  message?: string;
  trigger: ActiveTrigger;
  timestamp: Date;
}

export interface TriggerMonitorState {
  /** Whether auto-protect is enabled */
  enabled: boolean;
  /** Current trigger evaluation */
  evaluation: TriggerEvaluation | null;
  /** Recent auto-claims */
  recentAutoClaims: AutoClaimResult[];
  /** Full trigger event log */
  triggerLog: TriggerLogEntry[];
  /** Whether a claim is currently being filed */
  isFiling: boolean;
  /** Last check timestamp */
  lastCheckAt: Date | null;
  /** Number of auto-claims filed this session */
  sessionClaimCount: number;
  /** Toggle auto-protect on/off */
  toggleAutoProtect: () => void;
  /** Manually refresh evaluation */
  forceCheck: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MONITOR_INTERVAL = 30_000; // 30 seconds
const ENABLED_KEY = "klaimkavach_auto_protect";
const MAX_SESSION_CLAIMS = 5; // Safety cap per session

// ─── Sustained Breach Tracking ──────────────────────────────────────────────────

interface BreachTimer {
  ruleId: string;
  firstSeenAt: number;
  sustainedMinutes: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useTriggerMonitor(
  weather: WeatherData,
  traffic: TrafficData,
): TriggerMonitorState {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ENABLED_KEY) !== "false";
    } catch {
      return true;
    }
  });

  const [evaluation, setEvaluation] = useState<TriggerEvaluation | null>(null);
  const [recentAutoClaims, setRecentAutoClaims] = useState<AutoClaimResult[]>([]);
  const [triggerLog, setTriggerLog] = useState<TriggerLogEntry[]>(getTriggerLog);
  const [isFiling, setIsFiling] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<Date | null>(null);
  const [sessionClaimCount, setSessionClaimCount] = useState(0);

  const breachTimers = useRef<Map<string, BreachTimer>>(new Map());
  const isFilingRef = useRef(false);

  const toggleAutoProtect = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ENABLED_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // File an auto-claim
  const fileAutoClaim = useCallback(
    async (trigger: ActiveTrigger) => {
      if (isFilingRef.current) return;
      isFilingRef.current = true;
      setIsFiling(true);

      try {
        const email = localStorage.getItem("klaimkavach_email") ?? "";
        if (!email) return;

        const eval_ = evaluateTriggers(weather, traffic);

        const response = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            amount: 0, // Server calculates based on plan
            reason: `Auto-triggered: ${trigger.rule.label} — ${trigger.currentValue}${trigger.rule.unit} (threshold: ${trigger.rule.threshold}${trigger.rule.unit})`,
            hoursLost: eval_.suggestedHours,
            eventType: trigger.rule.category === "composite" ? "composite" : trigger.rule.category,
            latitude: weather.lat,
            longitude: weather.lon,
            eventRiskScore: eval_.compositeScore,
            rainIntensity: weather.rain1h,
            aqiLevel: weather.aqi,
            trafficCongestion: traffic.congestionLevel,
            source: "auto",
          }),
        });

        const payload = await response.json();

        const result: AutoClaimResult = {
          success: payload?.success ?? false,
          claimId: payload?.claimId,
          payoutAmount: payload?.payoutAmount,
          status: payload?.status,
          message: payload?.message,
          trigger,
          timestamp: new Date(),
        };

        // Mark cooldown regardless of success (prevent spam)
        markTriggerFired(trigger);

        // Log the trigger event
        addTriggerLogEntry({
          ruleId: trigger.rule.id,
          ruleLabel: trigger.rule.label,
          category: trigger.rule.category,
          currentValue: trigger.currentValue,
          threshold: trigger.rule.threshold,
          severity: trigger.severity,
          claimFiled: result.success,
          claimId: result.claimId,
          timestamp: Date.now(),
        });

        setRecentAutoClaims((prev) => [result, ...prev].slice(0, 10));
        setTriggerLog(getTriggerLog());
        setSessionClaimCount((c) => c + 1);

        // Update localStorage claim stats
        if (result.success) {
          const pastClaims = Number(localStorage.getItem("klaimkavach_past_claims") ?? "0");
          localStorage.setItem("klaimkavach_past_claims", String(pastClaims + 1));

          if (result.payoutAmount) {
            const saved = Number(localStorage.getItem("klaimkavach_total_saved") ?? "0");
            localStorage.setItem("klaimkavach_total_saved", String(saved + result.payoutAmount));
          }

          localStorage.setItem(
            "klaimkavach_last_claim",
            JSON.stringify({
              trigger: trigger.rule.label,
              time: new Date().toLocaleTimeString(),
              trustScore: 85,
              status: result.status,
              payout: result.payoutAmount,
              claimId: result.claimId,
              source: "auto",
            }),
          );
        }
      } catch {
        // Fail silently — will retry on next interval
      } finally {
        isFilingRef.current = false;
        setIsFiling(false);
      }
    },
    [weather, traffic],
  );

  const forceCheck = useCallback(() => {
    if (weather.isLoading || traffic.isLoading) return;

    const eval_ = evaluateTriggers(weather, traffic);
    setEvaluation(eval_);
    setLastCheckAt(new Date());

    if (!enabled || !eval_.autoClaimEligible) return;
    if (sessionClaimCount >= MAX_SESSION_CLAIMS) return;

    // Get triggers not on cooldown
    const eligibleTriggers = getTriggersNotOnCooldown(eval_.triggers);
    if (eligibleTriggers.length === 0) return;

    // Check sustained breach duration
    const now = Date.now();
    for (const trigger of eligibleTriggers) {
      const existing = breachTimers.current.get(trigger.rule.id);
      if (existing) {
        const elapsedMinutes = (now - existing.firstSeenAt) / 60_000;
        if (elapsedMinutes >= trigger.rule.sustainedMinutes) {
          // Breach sustained long enough — file claim!
          fileAutoClaim(trigger);
          breachTimers.current.delete(trigger.rule.id);
          break; // One claim at a time
        }
      } else {
        // First time seeing this breach — start timer
        breachTimers.current.set(trigger.rule.id, {
          ruleId: trigger.rule.id,
          firstSeenAt: now,
          sustainedMinutes: trigger.rule.sustainedMinutes,
        });
      }
    }

    // Clean up timers for triggers that are no longer active
    const activeRuleIds = new Set(eval_.triggers.map((t) => t.rule.id));
    for (const [ruleId] of breachTimers.current) {
      if (!activeRuleIds.has(ruleId)) {
        breachTimers.current.delete(ruleId);
      }
    }
  }, [weather, traffic, enabled, sessionClaimCount, fileAutoClaim]);

  // Periodic monitoring
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    forceCheck();

    const intervalId = setInterval(forceCheck, MONITOR_INTERVAL);
    return () => clearInterval(intervalId);
  }, [enabled, forceCheck]);

  return {
    enabled,
    evaluation,
    recentAutoClaims,
    triggerLog,
    isFiling,
    lastCheckAt,
    sessionClaimCount,
    toggleAutoProtect,
    forceCheck,
  };
}
