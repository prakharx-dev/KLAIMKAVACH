import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { plansById } from "@/lib/plans";
import { computeAIScoring } from "@/lib/ai-scoring-engine";
import { useWeather } from "@/hooks/use-weather";
import { useTraffic } from "@/hooks/use-traffic";
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
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectedPlan } = useAuth();
  const { toast } = useToast();
  const weather = useWeather();
  const traffic = useTraffic();

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
        description: "AI engine is evaluating your claim now.",
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
          ? "Calculating risk/trust model"
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
                  AI Verification in Progress
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
                  className="h-full rounded-full bg-emerald-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Telemetry</span>
                <span>AI Scoring</span>
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="relative overflow-hidden border-border/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_50%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.1),transparent_40%)]" />
        <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-2 font-semibold">
              Claim Studio
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              File a Smart Claim
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-2xl">
              Capture your disruption details, preview AI scoring, and submit
              with full transparency before payout processing starts.
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-6 items-start">
        <Card className="p-6 sm:p-8 space-y-8 border-border/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hours Lost
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Select the number of disrupted work hours for this claim.
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
                <span>Submit Claim</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </Card>

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
                  exit={{ y: 10, opacity: 0, position: "absolute" }}
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
                  <Navigation className="w-3 h-3" /> {traffic.currentSpeed} km/h
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/80 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                AI Decision Panel
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
                <p className="text-xs text-muted-foreground">Final Score</p>
                <p className="font-semibold text-foreground">
                  {aiScore.finalScore}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Confidence</p>
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
  );
}
