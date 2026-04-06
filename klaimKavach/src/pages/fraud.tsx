import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Info,
  Gauge,
  Sparkles,
  MapPin,
  CloudRain,
  Wind,
  Navigation,
  Shield,
  Activity,
} from "lucide-react";
import { computeAIScoring } from "@/lib/ai-scoring-engine";
import { useWeather } from "@/hooks/use-weather";
import { useTraffic } from "@/hooks/use-traffic";

import { Card } from "@/components/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Fraud() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const weather = useWeather();
  const traffic = useTraffic();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/register");
      return;
    }

    return undefined;
  }, [isAuthenticated, setLocation]);

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
    hours: 3,
    pastClaims,
    approvalRate,
    fraudFlags,
    consistency,
  });

  const trustScore = aiScore.trustScore;
  const trustStatus =
    trustScore > 75 ? "Excellent" : trustScore >= 45 ? "Moderate" : "High Risk";
  const trustLabel =
    trustScore > 75
      ? "Verified"
      : trustScore >= 45
        ? "Needs Review"
        : "Suspicious";
  const trustDetails =
    aiScore.reasons[0] ??
    "AI scoring synced with dashboard risk and trust profile.";
  const decisionLabel =
    aiScore.decision === "Approved"
      ? "Auto Approved"
      : aiScore.decision === "Pending"
        ? "Pending L2 Review"
        : "Flagged / Blocked";

  const telematicsText =
    weather.isLoading || traffic.isLoading
      ? "Collecting GPS and network telemetry..."
      : `Live telemetry active (${weather.city})`;

  if (!isAuthenticated) return null;

  if (weather.isLoading || traffic.isLoading) {
    return (
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <Skeleton className="h-10 w-64 bg-card" />
        <Skeleton className="h-56 w-full rounded-xl bg-card" />
        <Skeleton className="h-72 w-full rounded-xl bg-card" />
      </div>
    );
  }

  const isSuspicious = trustScore <= 70 && trustScore >= 30;
  const isFraud = trustScore < 30;

  let ColorIcon = ShieldCheck;
  let colorClass = "text-emerald-500";
  let bgClass = "bg-emerald-500";

  if (isSuspicious) {
    ColorIcon = AlertTriangle;
    colorClass = "text-amber-500";
    bgClass = "bg-amber-500";
  } else if (isFraud) {
    ColorIcon = ShieldAlert;
    colorClass = "text-destructive";
    bgClass = "bg-destructive";
  }

  const circumference = 2 * Math.PI * 54;
  const trustOffset = circumference * (1 - trustScore / 100);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 pb-16">
      <Card className="relative overflow-hidden border-border/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.15),transparent_45%)]" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Trust Engine Live
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-card/70 border border-border text-foreground">
              {telematicsText}
            </span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                Trust Score
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    AI analyzes trip history, GPS telemetry, and claim behavior
                    to continuously update trust and fraud risk.
                  </TooltipContent>
                </Tooltip>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Real-time fraud prevention and claim confidence dashboard.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Updated live from weather and traffic telemetry
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <Card className="p-6 sm:p-8 border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative w-36 h-36 shrink-0 mx-auto sm:mx-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className={colorClass}
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: trustOffset }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-4xl font-bold tabular-nums ${colorClass}`}
                >
                  {trustScore}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl ${bgClass}/10 flex items-center justify-center`}
                >
                  <ColorIcon className={`w-5 h-5 ${colorClass}`} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    Current Band
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {trustLabel}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {trustDetails}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {trustStatus}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Decision
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {decisionLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-border/80">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              Risk Score
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {aiScore.riskScore}
              <span className="text-sm text-muted-foreground">/100</span>
            </p>
          </Card>
          <Card className="p-4 border-border/80">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              Final Score
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {aiScore.finalScore}
            </p>
          </Card>
          <Card className="p-4 border-border/80">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              Fraud Confidence
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {Math.round(aiScore.fraudConfidence)}%
            </p>
          </Card>
          <Card className="p-4 border-border/80">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              System Confidence
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {aiScore.systemConfidence}
            </p>
          </Card>
          <Card className="p-4 border-border/80 col-span-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Formula
            </p>
            <p className="text-sm text-foreground flex items-center gap-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              Final = (Risk x 0.6) + (Trust x 0.4)
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 border-border/80">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
            Live Context
          </p>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> City
              </span>
              <span className="text-foreground font-medium">
                {weather.city}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <CloudRain className="w-3.5 h-3.5" /> Rainfall
              </span>
              <span className="text-foreground font-medium">
                {weather.rain1h.toFixed(1)} mm/h
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Wind className="w-3.5 h-3.5" /> AQI
              </span>
              <span className="text-foreground font-medium">
                {weather.aqi} ({weather.aqiLabel})
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5" /> Traffic
              </span>
              <span className="text-foreground font-medium">
                {traffic.congestionLevel}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Trigger
              </span>
              <span className="text-foreground font-medium">{trigger}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/80">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
            Profile Inputs
          </p>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Approval Rate
              </span>
              <span className="text-foreground font-medium">
                {approvalRate}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Past Claims</span>
              <span className="text-foreground font-medium">{pastClaims}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Fraud Flags</span>
              <span className="text-foreground font-medium">{fraudFlags}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Consistency</span>
              <span className="text-foreground font-medium">{consistency}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Decision</span>
              <span className="text-foreground font-medium">
                {decisionLabel}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 border-border/80">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">
          Scoring Reasons
        </p>
        <div className="space-y-2">
          {aiScore.reasons.length > 0 ? (
            aiScore.reasons.map((reason, idx) => (
              <div
                key={`${reason}-${idx}`}
                className="flex items-start gap-3 text-sm text-foreground/90 bg-secondary/70 rounded-lg px-3 py-2.5 border border-border"
              >
                <span className="text-xs text-muted-foreground w-5 shrink-0 mt-0.5">
                  {idx + 1}.
                </span>
                <span>{reason}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No scoring reasons generated.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
