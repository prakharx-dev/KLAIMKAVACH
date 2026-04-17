import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { plansById } from "@/lib/plans";
import { computeAIScoring } from "@/lib/ai-scoring-engine";
import { useWeather } from "@/hooks/use-weather";
import { useTraffic } from "@/hooks/use-traffic";
import { useTriggerMonitor } from "@/hooks/use-trigger-monitor";
import { TRIGGER_RULES } from "@/lib/trigger-engine";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  FileText,
  CheckCircle,
  ArrowRight,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  CloudRain,
  Wind,
  Navigation,
  Activity,
  Sparkles,
  Radar,
  Zap,
  ToggleLeft,
  ToggleRight,
  Brain,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CircleDot,
  ArrowUpRight,
} from "lucide-react";

import { Card } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function Claim() {
  type ClaimSubmitResult = {
    success: boolean;
    claimId?: string;
    payoutAmount?: number;
    status?: string;
    message?: string;
  };

  const [hours, setHours] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<
    ClaimSubmitResult | undefined
  >();
  const [pendingResult, setPendingResult] = useState<
    ClaimSubmitResult | undefined
  >();
  const [processingPhase, setProcessingPhase] = useState<
    "idle" | "collecting" | "scoring" | "finalizing"
  >("idle");
  const [animatedScores, setAnimatedScores] = useState({
    risk: 0,
    trust: 0,
    final: 0,
  });
  const [reviewSnapshot, setReviewSnapshot] = useState<
    | {
        risk: number;
        trust: number;
        final: number;
        decisionLabel: string;
        trigger: string;
        city: string;
        rain: number;
        trafficStatus: string;
        trafficSpeed: number;
      }
    | undefined
  >();
  const [showManualForm, setShowManualForm] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectedPlan } = useAuth();
  const { toast } = useToast();
  const weather = useWeather();
  const traffic = useTraffic();
  const triggerMonitor = useTriggerMonitor(weather, traffic);

  const activePlan = selectedPlan ? plansById[selectedPlan] : null;
  const payoutPerHour = activePlan?.claimPayoutPerHour ?? 120;
  const maxHours = activePlan?.claimHoursCap ?? 8;

  useEffect(() => {
    setHours((prev) => Math.min(Math.max(prev, 1), maxHours));
  }, [maxHours]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/register");
      return;
    }

    if (!selectedPlan) {
      setLocation("/pricing");
    }
  }, [isAuthenticated, selectedPlan, setLocation]);

  if (!isAuthenticated || !selectedPlan || !activePlan) return null;

  const totalPayout = hours * payoutPerHour;

  const pastClaims = Number(
    localStorage.getItem("klaimkavach_past_claims") ?? "0",
  );
  const approvalRate = Number(
    localStorage.getItem("klaimkavach_approval_rate") ?? "80",
  );
  const fraudFlags = Number(
    localStorage.getItem("klaimkavach_fraud_flags") ?? "0",
  );

  const trigger =
    traffic.congestionLevel > 50
      ? "Traffic Jam"
      : weather.rain1h > 1
        ? "Heavy Rain"
        : "Poor AQI";

  const consistency =
    approvalRate > 80 ? "High" : approvalRate >= 50 ? "Medium" : "Low";

  const aiScore = computeAIScoring({
    location: weather.city,
    ipType: "Genuine",
    speed: traffic.currentSpeed,
    trigger,
    hours,
    pastClaims,
    approvalRate,
    fraudFlags,
    consistency,
    rainIntensity: weather.rain1h,
    aqiLevel: weather.aqi,
    trafficCongestion: traffic.congestionLevel,
  });

  const decisionLabel =
    aiScore.decision === "Approved"
      ? "Auto Approved"
      : aiScore.decision === "Pending"
        ? "Pending L2 Review"
        : "Flagged / Blocked";

  const finalScoreFormula =
    aiScore.reasons.find((entry) => entry.startsWith("Final Score =")) ??
    "Final Score = (Risk x 0.6) + (Trust x 0.4)";

  const displayReasons = aiScore.reasons.slice(0, 6);

  const triggerTone =
    trigger === "Heavy Rain"
      ? "text-cyan-300 border-cyan-400/25 bg-cyan-500/10"
      : trigger === "Traffic Jam"
        ? "text-amber-300 border-amber-400/25 bg-amber-500/10"
        : "text-sky-300 border-sky-400/25 bg-sky-500/10";

  const decisionTone =
    aiScore.decision === "Approved"
      ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
      : aiScore.decision === "Pending"
        ? "text-amber-400 border-amber-500/20 bg-amber-500/10"
        : "text-red-400 border-red-500/20 bg-red-500/10";

  const isReviewing = processingPhase !== "idle";

  useEffect(() => {
    if (processingPhase !== "scoring" || !reviewSnapshot) return;

    let step = 0;
    const maxSteps = 12;
    const id = window.setInterval(() => {
      step += 1;
      const factor = Math.min(step / maxSteps, 1);

      setAnimatedScores({
        risk: Math.round(reviewSnapshot.risk * factor),
        trust: Math.round(reviewSnapshot.trust * factor),
        final: Number((reviewSnapshot.final * factor).toFixed(2)),
      });

      if (factor >= 1) {
        clearInterval(id);
        setProcessingPhase("finalizing");
      }
    }, 45);

    return () => clearInterval(id);
  }, [processingPhase, reviewSnapshot]);

  useEffect(() => {
    if (
      processingPhase !== "finalizing" ||
      !pendingResult?.success ||
      !reviewSnapshot
    )
      return;

    setAnimatedScores({
      risk: reviewSnapshot.risk,
      trust: reviewSnapshot.trust,
      final: reviewSnapshot.final,
    });

    const timeoutId = window.setTimeout(() => {
      setSuccessData(pendingResult);
      setPendingResult(undefined);
      setProcessingPhase("idle");
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [processingPhase, pendingResult, reviewSnapshot]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setProcessingPhase("collecting");
      setPendingResult(undefined);
      setAnimatedScores({ risk: 0, trust: 0, final: 0 });
      setReviewSnapshot({
        risk: aiScore.riskScore,
        trust: aiScore.trustScore,
        final: aiScore.finalScore,
        decisionLabel,
        trigger,
        city: weather.city,
        rain: weather.rain1h,
        trafficStatus: traffic.status,
        trafficSpeed: traffic.currentSpeed,
      });
      const email = localStorage.getItem("klaimkavach_email") ?? "";

      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: totalPayout,
          reason: reason || "Heavy Rain / Disruption",
          hoursLost: hours,
          eventType:
            trigger === "Traffic Jam"
              ? "traffic"
              : trigger === "Heavy Rain"
                ? "rain"
                : "aqi",
          latitude: weather.lat,
          longitude: weather.lon,
          eventRiskScore: aiScore.riskScore,
          rainIntensity: weather.rain1h,
          aqiLevel: weather.aqi,
          trafficCongestion: traffic.congestionLevel,
          aiScoring: aiScore,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Could not submit claim.");
      }

      setPendingResult(payload);
      setProcessingPhase("scoring");
      const savedSoFar = Number(
        localStorage.getItem("klaimkavach_total_saved") ?? "0",
      );
      const thisPayout = Number(payload?.payoutAmount ?? totalPayout);
      const nextSaved = Math.max(0, savedSoFar) + Math.max(0, thisPayout);
      localStorage.setItem("klaimkavach_total_saved", String(nextSaved));

      const existingBreakdown = JSON.parse(
        localStorage.getItem("klaimkavach_claim_breakdown") ??
          '{"rain":0,"aqi":0,"traffic":0}',
      ) as { rain?: number; aqi?: number; traffic?: number };

      const normalizedTrigger =
        trigger === "Heavy Rain"
          ? "rain"
          : trigger === "Poor AQI"
            ? "aqi"
            : "traffic";

      const nextBreakdown = {
        rain: existingBreakdown.rain ?? 0,
        aqi: existingBreakdown.aqi ?? 0,
        traffic: existingBreakdown.traffic ?? 0,
      };
      nextBreakdown[normalizedTrigger] += 1;
      localStorage.setItem(
        "klaimkavach_claim_breakdown",
        JSON.stringify(nextBreakdown),
      );

      localStorage.setItem(
        "klaimkavach_last_claim",
        JSON.stringify({
          trigger,
          time: new Date().toLocaleTimeString(),
          trustScore: aiScore.trustScore,
          status: payload?.status ?? aiScore.decision,
          payout: payload?.payoutAmount ?? totalPayout,
          claimId: payload?.claimId,
        }),
      );

      localStorage.setItem(
        "klaimkavach_past_claims",
        String(Math.max(0, pastClaims) + 1),
      );

      if (aiScore.decision === "Approved") {
        const newApprovalRate = Math.min(100, approvalRate + 1);
        localStorage.setItem(
          "klaimkavach_approval_rate",
          String(newApprovalRate),
        );
      }

      if (aiScore.decision === "Flagged") {
        localStorage.setItem(
          "klaimkavach_fraud_flags",
          String(Math.max(0, fraudFlags) + 1),
        );
      }

      toast({
        title: "Claim submitted",
        description: "ML engine is evaluating your claim now.",
      });
    } catch (error: any) {
      setProcessingPhase("idle");
      setPendingResult(undefined);
      setReviewSnapshot(undefined);
      toast({
        title: "Claim failed",
        description:
          error?.message ||
          "Could not submit claim. Please try again in a few seconds.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Review Screen ───────────────────────────────────────────────────────────
  if (isReviewing) {
    const progress =
      processingPhase === "collecting"
        ? 28
        : processingPhase === "scoring"
          ? 72
          : 100;

    const phaseLabel =
      processingPhase === "collecting"
        ? "Collecting telemetry signals"
        : processingPhase === "scoring"
          ? "Running ML neural network scoring"
          : "Finalizing decision and payout";

    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-2xl"
        >
          <Card className="p-8 border-border/80 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-1.5">
                  Claim Evaluation
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  ML Verification in Progress
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {phaseLabel}
                </p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500 mt-1" />
            </div>

            <div className="space-y-2">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Telemetry</span>
                <span>Neural Net Scoring</span>
                <span>Decision</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Risk</p>
                <p className="font-semibold text-foreground">
                  {animatedScores.risk}/100
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Trust</p>
                <p className="font-semibold text-foreground">
                  {animatedScores.trust}/100
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Final</p>
                <p className="font-semibold text-foreground">
                  {animatedScores.final}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Decision</p>
                <p className="font-semibold text-foreground">
                  {reviewSnapshot?.decisionLabel ?? decisionLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-muted-foreground mb-1">Trigger</p>
                <p className="font-semibold text-foreground">
                  {reviewSnapshot?.trigger ?? trigger}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-muted-foreground mb-1">City & Rain</p>
                <p className="font-semibold text-foreground">
                  {reviewSnapshot?.city ?? weather.city} ·{" "}
                  {reviewSnapshot?.rain ?? weather.rain1h}mm
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-muted-foreground mb-1">Traffic</p>
                <p className="font-semibold text-foreground">
                  {reviewSnapshot?.trafficStatus ?? traffic.status} ·{" "}
                  {reviewSnapshot?.trafficSpeed ?? traffic.currentSpeed} km/h
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Success Screen ──────────────────────────────────────────────────────────
  if (successData?.success) {
    const status = (successData.status ?? aiScore.decision ?? "Pending")
      .toString()
      .toLowerCase();
    const isApproved = status.includes("approved");
    const statusLabel = isApproved
      ? "Auto Approved"
      : status.includes("flag") || status.includes("block")
        ? "Flagged / Blocked"
        : "Pending L2 Review";

    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md text-center"
        >
          <Card className="p-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              {statusLabel}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {successData.message}
            </p>

            <div className="w-full bg-secondary rounded-xl p-5 mb-8 text-left">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-muted-foreground font-semibold uppercase tracking-widest text-xs">
                  Claim ID
                </span>
                <span className="text-foreground font-mono">
                  {successData.claimId}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-5 pb-5 border-b border-border">
                <span className="text-muted-foreground font-semibold uppercase tracking-widest text-xs">
                  Status
                </span>
                <span
                  className={`font-medium ${
                    isApproved
                      ? "text-emerald-500"
                      : statusLabel === "Pending L2 Review"
                        ? "text-amber-500"
                        : "text-red-400"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-muted-foreground font-semibold uppercase tracking-widest text-xs">
                  Approved Payout
                </span>
                <span className="text-3xl font-bold text-foreground tabular-nums leading-none">
                  ₹{totalPayout}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-10"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Back to Dashboard
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Main Claim Page ─────────────────────────────────────────────────────────

  // Get stored auto-claim log
  const autoClaimLog: Array<{
    timestamp: string;
    ruleId: string;
    ruleLabel: string;
    value: number;
    threshold: number;
    unit: string;
    severity: string;
    payout?: number;
    success?: boolean;
  }> = JSON.parse(
    localStorage.getItem("klaimkavach_auto_claim_log") ?? "[]",
  );

  const { enabled, evaluation, recentAutoClaims, isFiling, lastCheckAt, sessionClaimCount, toggleAutoProtect } = triggerMonitor;

  // Currently active trigger values
  const triggerValues = [
    { rule: TRIGGER_RULES.find(r => r.id === "rain_heavy")!, value: weather.rain1h, current: weather.rain1h },
    { rule: TRIGGER_RULES.find(r => r.id === "aqi_hazardous")!, value: weather.aqi, current: weather.aqi },
    { rule: TRIGGER_RULES.find(r => r.id === "traffic_severe")!, value: traffic.congestionLevel, current: traffic.congestionLevel },
  ].filter(t => t.rule);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
      {/* ── Header ── */}
      <Card className="relative overflow-hidden border-border/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_50%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.1),transparent_40%)]" />
        <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Radar className="w-3 h-3" /> Parametric Engine
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
                <Brain className="w-3 h-3" /> ML-Powered
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Claim Engine
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-2xl">
              Zero-touch parametric claims are filed automatically when
              environmental thresholds are breached. Manual claims are available
              as a fallback option.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-wide">
              {activePlan.name}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-border bg-secondary/60 text-xs font-medium text-foreground">
              Coverage: {activePlan.coverage}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-border bg-secondary/60 text-xs font-medium text-foreground">
              {maxHours}h cap
            </span>
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 1: Automated Parametric Claims ═══ */}
      <Card className="border-border/80 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Section Header + Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground tracking-tight">
                  Auto-Triggered Claims
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Zero-touch parametric insurance — claims filed automatically
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleAutoProtect}
              className="flex items-center gap-2 px-4 py-2 rounded-full border transition-colors"
              style={{
                borderColor: enabled
                  ? "rgba(16,185,129,0.3)"
                  : "rgba(255,255,255,0.1)",
                background: enabled
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(255,255,255,0.03)",
              }}
            >
              {enabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500">
                    Active
                  </span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">
                    Disabled
                  </span>
                </>
              )}
            </button>
          </div>

          {/* How It Works */}
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              How Parametric Auto-Claims Work
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                {
                  step: "1",
                  title: "Monitor",
                  desc: "Sensors poll weather, AQI & traffic every 30 seconds",
                  icon: <Radar className="w-4 h-4" />,
                },
                {
                  step: "2",
                  title: "Detect",
                  desc: "Parametric thresholds are compared against live data",
                  icon: <AlertTriangle className="w-4 h-4" />,
                },
                {
                  step: "3",
                  title: "Verify",
                  desc: "ML neural network runs fraud detection in <1ms",
                  icon: <Brain className="w-4 h-4" />,
                },
                {
                  step: "4",
                  title: "Payout",
                  desc: "Claim auto-filed & payout credited if no fraud detected",
                  icon: <Zap className="w-4 h-4" />,
                },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
                    <span className="text-emerald-500">{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {s.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Trigger Monitor */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Live Trigger Monitor
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRIGGER_RULES.filter(r => r.category !== "composite").slice(0, 6).map((rule) => {
                const currentValue =
                  rule.id.startsWith("rain") ? weather.rain1h :
                  rule.id.startsWith("aqi") ? weather.aqi :
                  rule.id.startsWith("traffic") ? traffic.congestionLevel : 0;

                const pct = Math.min(100, (currentValue / rule.threshold) * 100);
                const isBreached = currentValue >= rule.threshold;

                return (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isBreached
                        ? "bg-red-500/5 border-red-500/20"
                        : "bg-white/[0.02] border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">
                        {rule.label}
                      </span>
                      {isBreached ? (
                        <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                          <CircleDot className="w-2.5 h-2.5" /> BREACHED
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          SAFE
                        </span>
                      )}
                    </div>

                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-2xl font-bold text-foreground tabular-nums">
                        {Math.round(currentValue * 10) / 10}
                      </span>
                      <span className="text-xs text-muted-foreground mb-1">
                        / {rule.threshold}
                        {rule.unit}
                      </span>
                    </div>

                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full transition-colors ${
                          isBreached
                            ? "bg-red-500/60"
                            : pct > 60
                              ? "bg-amber-500/60"
                              : "bg-emerald-500/40"
                        }`}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Multiplier: {rule.severityMultiplier}x · Sustained: {rule.sustainedMinutes}m
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Banner */}
          {enabled && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-500">
                    {isFiling
                      ? "Filing auto-claim right now..."
                      : evaluation?.isBreached
                        ? `${evaluation.triggers.length} trigger(s) breached — monitoring sustained breach duration`
                        : "All triggers within safe limits — monitoring continues every 30s"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Last check: {lastCheckAt?.toLocaleTimeString() ?? "—"} ·
                    Session auto-claims: {sessionClaimCount} ·
                    Polling interval: 30s
                  </p>
                </div>
              </div>
            </div>
          )}

          {!enabled && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">
                    Auto-Protect is disabled
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Enable the toggle above to activate zero-touch parametric
                    claim filing. When a threshold is breached for the required
                    duration, a claim will be filed and paid automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Auto-Claims Timeline */}
          {recentAutoClaims.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Recent Auto-Triggered Claims
              </p>
              <div className="space-y-2">
                {recentAutoClaims.slice(0, 5).map((ac, i) => (
                  <motion.div
                    key={`ac-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      ac.success
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : "bg-red-500/5 border-red-500/15"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {ac.success ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {ac.trigger.rule.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Value: {ac.trigger.currentValue}{ac.trigger.rule.unit} ·
                          Threshold: {ac.trigger.rule.threshold}{ac.trigger.rule.unit} ·
                          {new Date(ac.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          ac.success ? "text-emerald-500" : "text-red-400"
                        }`}
                      >
                        {ac.success ? `₹${ac.payoutAmount ?? 0}` : "Failed"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {ac.success ? "Auto-Paid" : ac.message ?? "Error"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-claim from localStorage */}
          {autoClaimLog.length > 0 && recentAutoClaims.length === 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Auto-Claim History
              </p>
              <div className="space-y-2">
                {autoClaimLog.slice(0, 5).map((log, i) => (
                  <div
                    key={`log-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-emerald-500/60 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {log.ruleLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {log.value}{log.unit} · Severity: {log.severity} ·{" "}
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {log.payout !== undefined && (
                      <span className="text-sm font-bold text-emerald-500 tabular-nums">
                        ₹{log.payout}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ═══ SECTION 2: Manual Claim Form (Collapsible) ═══ */}
      <Card className="border-border/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualForm(!showManualForm)}
          className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Manual Claim
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submit a claim manually as a fallback if auto-triggering isn't
                active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/10 px-2.5 py-1 rounded-full uppercase tracking-widest">
              Fallback
            </span>
            {showManualForm ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {showManualForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-8 border-t border-white/5">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-6 items-start pt-6">
                  {/* Left panel */}
                  <div className="space-y-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Hours Lost
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Select the number of disrupted work hours for this
                          claim.
                        </p>
                      </div>
                      <div className="text-4xl font-bold text-foreground tabular-nums leading-none">
                        {hours}
                        <span className="text-base font-medium text-muted-foreground ml-1">
                          h
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="range"
                        min="1"
                        max={maxHours}
                        value={hours}
                        onChange={(e) => setHours(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <style>{`
                        input[type=range]::-webkit-slider-thumb {
                          appearance: none;
                          width: 18px;
                          height: 18px;
                          border-radius: 999px;
                          background: hsl(var(--foreground));
                          cursor: pointer;
                          border: 2px solid hsl(var(--background));
                          box-shadow: 0 0 0 1px hsl(var(--border));
                        }
                      `}</style>
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>1h</span>
                        <span>{Math.ceil(maxHours / 2)}h</span>
                        <span>{maxHours}h</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border bg-secondary/50 p-3.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">
                          Trigger
                        </p>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium ${triggerTone}`}
                        >
                          {trigger}
                        </span>
                      </div>

                      <div className="rounded-xl border border-border bg-secondary/50 p-3.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">
                          Telemetry
                        </p>
                        <div className="text-sm text-foreground flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                          {traffic.status} · {traffic.congestionLevel}%
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-secondary/50 p-3.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">
                          Weather
                        </p>
                        <div className="text-sm text-foreground flex items-center gap-2">
                          <CloudRain className="w-3.5 h-3.5 text-muted-foreground" />
                          {weather.city} · {weather.rain1h}mm
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4" />
                        Additional Details
                      </h3>
                      <Textarea
                        placeholder="Add context for the disruption (route blocked, order delays, area conditions, etc.)"
                        className="bg-background border-border focus:border-primary text-foreground min-h-28 resize-none"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full h-12 text-base font-medium"
                      onClick={handleSubmit}
                      disabled={isSubmitting || isReviewing}
                    >
                      {isSubmitting ? (
                        <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing Claim...</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                          <span>Submit Manual Claim</span>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Right panel */}
                  <div className="space-y-4">
                    <Card className="p-6 border-border/80">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Payout Preview
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {hours}h × ₹{payoutPerHour}/hr
                        </span>
                      </div>

                      <div className="text-4xl font-bold text-foreground tabular-nums flex items-center gap-1 mb-4">
                        ₹
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={totalPayout}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{
                              y: 10,
                              opacity: 0,
                              position: "absolute",
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            {totalPayout}
                          </motion.span>
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-secondary/50 border border-border p-2.5">
                          <p className="text-muted-foreground mb-1">Rain</p>
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <CloudRain className="w-3 h-3" /> {weather.rain1h}mm
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 border border-border p-2.5">
                          <p className="text-muted-foreground mb-1">AQI</p>
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <Wind className="w-3 h-3" /> {weather.aqi}
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 border border-border p-2.5">
                          <p className="text-muted-foreground mb-1">Traffic</p>
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <Navigation className="w-3 h-3" />{" "}
                            {traffic.currentSpeed} km/h
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/80 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          ML Decision Panel
                        </h3>
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${decisionTone}`}
                        >
                          {decisionLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">Risk</p>
                          <p className="font-semibold text-foreground">
                            {aiScore.riskScore}/100
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">Trust</p>
                          <p className="font-semibold text-foreground">
                            {aiScore.trustScore}/100
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">
                            Final Score
                          </p>
                          <p className="font-semibold text-foreground">
                            {aiScore.finalScore}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">
                            Confidence
                          </p>
                          <p className="font-semibold text-foreground">
                            {aiScore.systemConfidence}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg bg-secondary/30 border border-border p-3">
                        {aiScore.decision === "Flagged" ? (
                          <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                        )}
                        <span>{finalScoreFormula}</span>
                      </div>

                      <div className="rounded-lg border border-border bg-secondary/20 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          Reasoning Log
                        </p>
                        <div className="space-y-2 max-h-52 overflow-auto pr-1">
                          {displayReasons.length > 0 ? (
                            displayReasons.map((entry, index) => (
                              <p
                                key={`${entry}-${index}`}
                                className="text-xs text-muted-foreground leading-relaxed"
                              >
                                {index + 1}. {entry}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Scoring completed. No additional penalty signals.
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
