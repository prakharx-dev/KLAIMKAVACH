import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWeather, type WeatherData } from "@/hooks/use-weather";
import { useTraffic, type TrafficData } from "@/hooks/use-traffic";
import { useTriggerMonitor } from "@/hooks/use-trigger-monitor";
import { useDisasterAlerts } from "@/hooks/use-disaster-alerts";
import { useForecast } from "@/hooks/use-forecast";
import { plansById, type InsurancePlan, type PlanId } from "@/lib/plans";
import {
  computeAIScoring,
  type AIScoringInput,
  type AIScoringOutput,
} from "@/lib/ai-scoring-engine";
import { getModelStatus } from "@/lib/ml-fraud-model";
import { getHyperLocalRisk, getHazardLabel } from "@/lib/hyper-local-risk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  CloudRain,
  Activity,
  Bell,
  Zap,
  CheckCircle2,
  XCircle,
  Wind,
  Navigation,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  FileText,
  Eye,
  Clock,
  Wifi,
  Cpu,
  Lock,
  MapPin,
  BarChart3,
  Sparkles,
  Radio,
  CircleDot,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  ArrowRight,
  Thermometer,
  Droplets,
  ShieldCheck,
  Brain,
  Radar,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK = {
  userName: "Gig",
  weeklyPremium: 99,
  plan: "Elite",
  coverage: ["Rain", "AQI", "Traffic"],
  riskScore: 38,
  riskLevel: "Medium",
  riskBreakdown: { rain: 60, aqi: 210, traffic: "Moderate" },
  aiExplanation: "Moderate disruption risk due to weather changes",
  triggers: [
    { label: "Rainfall", value: "52mm", status: "ACTIVE", icon: "rain" },
    { label: "AQI Index", value: "310", status: "ACTIVE", icon: "aqi" },
    { label: "Traffic", value: "Normal", status: "INACTIVE", icon: "traffic" },
  ],
  lastClaim: {
    trigger: "Heavy Rain",
    time: "2:10 PM",
    trustScore: 88,
    status: "Auto Approved",
    payout: 150,
  },
  trustScore: 84,
  trustChecks: [
    { label: "GPS Match", ok: true, icon: "gps" },
    { label: "Sensor Valid", ok: true, icon: "sensor" },
    { label: "Behavior Normal", ok: true, icon: "behavior" },
  ],
  alerts: [
    {
      msg: "Heavy rain detected — You are covered",
      type: "rain",
      time: "2:10 PM",
    },
    {
      msg: "Claim auto-triggered — ₹150 credited",
      type: "claim",
      time: "2:11 PM",
    },
    { msg: "AQI high — Protection active", type: "aqi", time: "3:00 PM" },
  ],
  earningsSaved: 950,
  disruptionsCovered: 3,
  validConditions: ["Rain > 40mm", "AQI > 300", "Traffic Score < 30"],
  exclusions: ["User inactive", "GPS mismatch", "Low trust score"],
  systemHealth: [
    { label: "AI Engine", status: "Online", pct: 99 },
    { label: "Data Feed", status: "Live", pct: 100 },
    { label: "Claim API", status: "Active", pct: 97 },
  ],
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface LiveRiskSnapshot {
  score: number;
  label: "Low Risk" | "Medium Risk" | "High Risk";
}

type CityRiskProfile = "metro" | "urban";

function getCityRiskProfile(city: string): CityRiskProfile {
  const metroCities = new Set([
    "delhi",
    "new delhi",
    "mumbai",
    "bengaluru",
    "bangalore",
    "kolkata",
    "chennai",
    "hyderabad",
    "pune",
    "ahmedabad",
  ]);

  const normalized = city.trim().toLowerCase();
  return metroCities.has(normalized) ? "metro" : "urban";
}

function computeLiveRiskSnapshot(
  weather: WeatherData,
  traffic: TrafficData,
): LiveRiskSnapshot {
  const cityProfile = getCityRiskProfile(weather.city);

  const rainNormalizer = cityProfile === "metro" ? 10 : 8;
  const trafficWeight = cityProfile === "metro" ? 0.4 : 0.3;
  const rainWeight = cityProfile === "metro" ? 0.25 : 0.35;
  const aqiWeight = cityProfile === "metro" ? 0.25 : 0.25;
  const windWeight = cityProfile === "metro" ? 0.1 : 0.1;

  const aqiRisk = clampNumber(((weather.aqi - 50) / 300) * 100, 0, 100);
  const trafficRisk = clampNumber(traffic.congestionLevel, 0, 100);
  const windRisk = clampNumber((weather.windSpeed / 50) * 100, 0, 100);

  const normalizedRainRisk = clampNumber(
    (weather.rain1h / rainNormalizer) * 100,
    0,
    100,
  );

  const score = Math.round(
    normalizedRainRisk * rainWeight +
      aqiRisk * aqiWeight +
      trafficRisk * trafficWeight +
      windRisk * windWeight,
  );

  const lowToMediumThreshold = cityProfile === "metro" ? 40 : 35;
  const mediumToHighThreshold = cityProfile === "metro" ? 72 : 70;

  if (score < lowToMediumThreshold) return { score, label: "Low Risk" };
  if (score < mediumToHighThreshold) return { score, label: "Medium Risk" };
  return { score, label: "High Risk" };
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({
  value,
  duration = 1200,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = display;
    startTimeRef.current = null;
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min(
        (timestamp - startTimeRef.current) / duration,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(
        Math.round(startRef.current + (value - startRef.current) * eased),
      );
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display}</>;
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────
function PulseDot({ size = "sm" }: { size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-2.5 w-2.5" : "h-1.5 w-1.5";
  return (
    <span className={cn("relative flex", sz)}>
      <span
        className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-emerald-500",
        )}
      />
      <span
        className={cn("relative inline-flex rounded-full bg-emerald-500", sz)}
      />
    </span>
  );
}

// ─── Card Shell ───────────────────────────────────────────────────────────────
function DashCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      className={cn(
        "relative rounded-xl border border-[#1f1f1f] bg-[#111] p-5 transition-all duration-200 hover:border-[#2a2a2a]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

// ─── Card Label ───────────────────────────────────────────────────────────────
function CardLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#2a2a2a] bg-[#1a1a1a] text-white/40 shrink-0">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
        {label}
      </p>
    </div>
  );
}

// ─── 1. Active Coverage Card ───────────────────────────────────────────────────
function ActiveCoverageCard({
  weather,
  traffic,
  currentPlan,
}: {
  weather: WeatherData;
  traffic: TrafficData;
  currentPlan: InsurancePlan;
}) {
  const coverageIcons: Record<string, React.ReactNode> = {
    Rain: <CloudRain className="w-3 h-3" />,
    AQI: <Wind className="w-3 h-3" />,
    Traffic: <Navigation className="w-3 h-3" />,
  };

  // Generate dynamic next-risk based on real weather and traffic
  const nextRiskMsg =
    weather.rain1h > 0
      ? `Rain detected — ${weather.rain1h}mm in last hour`
      : traffic.congestionLevel > 50
        ? `Heavy Traffic — ${traffic.congestionLevel}% congestion`
        : weather.aqi > 200
          ? `AQI at ${weather.aqi} — Air quality poor`
          : weather.windSpeed > 40
            ? `High winds — ${weather.windSpeed} km/h`
            : traffic.congestionLevel > 20
              ? `Moderate Traffic — Drive safely`
              : `${weather.description} in ${weather.city}`;

  return (
    <DashCard
      className="col-span-1 lg:col-span-2 xl:col-span-2 flex flex-col gap-5"
      delay={0.05}
    >
      <div className="flex items-start justify-between">
        <CardLabel
          icon={<Shield className="w-4 h-4" />}
          label="Active Coverage"
        />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <PulseDot />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
            Protected
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-1">
            Weekly Premium
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
              ₹{currentPlan.weeklyPremium}
            </span>
            <span className="text-white/30 text-sm font-medium">/week</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1">
            Plan
          </p>
          <span className="text-lg font-bold text-foreground">
            {currentPlan.name}
          </span>
        </div>
      </div>

      {/* Coverage tags */}
      <div className="flex flex-wrap gap-2">
        {[
          "Rain",
          "AQI",
          "Traffic",
          `${currentPlan.claimHoursCap}h Claim Cap`,
        ].map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-medium"
          >
            {coverageIcons[c] ?? <Shield className="w-3 h-3" />} {c}
          </span>
        ))}
      </div>

      {/* Live weather banner */}
      <div className="mt-auto rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          {weather.rain1h > 0 ? (
            <CloudRain className="w-3.5 h-3.5 text-white/40" />
          ) : (
            <Eye className="w-3.5 h-3.5 text-white/30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {weather.isLoading ? "Fetching weather..." : nextRiskMsg}
          </p>
          <p className="text-[11px] text-white/20 mt-0.5">
            {weather.city} · {weather.temp}°C · Updated{" "}
            {weather.updatedAt.toLocaleTimeString()}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/15 shrink-0" />
      </div>
    </DashCard>
  );
}

// ─── 2. Live Risk Score Card ───────────────────────────────────────────────────
function LiveRiskScoreCard({
  weather,
  traffic,
  liveRisk,
}: {
  weather: WeatherData;
  traffic: TrafficData;
  liveRisk: LiveRiskSnapshot;
}) {
  const score = liveRisk.score;

  // Dynamic explanation based on real data
  const explanation =
    weather.isLoading || traffic.isLoading
      ? "Fetching live data..."
      : traffic.congestionLevel > 50
        ? `Severe traffic congestion (${traffic.congestionLevel}%) — high delay risk`
        : weather.rain1h > 2
          ? `Heavy rain detected (${weather.rain1h}mm/h) — high disruption risk in ${weather.city}`
          : weather.aqi > 300
            ? `AQI at ${weather.aqi} (${weather.aqiLabel}) — severe air quality risk`
            : traffic.congestionLevel > 20
              ? `Moderate traffic (${traffic.congestionLevel}%) — minor delay risk`
              : weather.aqi > 200
                ? `AQI at ${weather.aqi} (${weather.aqiLabel}) — coverage active for air quality`
                : weather.rain1h > 0
                  ? `Light rain (${weather.rain1h}mm/h) — monitoring conditions in ${weather.city}`
                  : `Conditions stable in ${weather.city} — ${weather.description}, flow normal`;

  const riskColor =
    score < 30 ? "#10b981" : score <= 60 ? "#f59e0b" : "#ef4444";
  const riskLabel = liveRisk.label;

  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <DashCard className="flex flex-col gap-4" delay={0.1}>
      <div className="flex items-center justify-between">
        <CardLabel
          icon={<Activity className="w-4 h-4" />}
          label="Live Risk Score"
        />
        <PulseDot />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-28 h-28 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={riskColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground tabular-nums leading-none">
              <AnimatedCounter value={score} />
            </span>
            <span className="text-[10px] text-white/20 font-medium">/100</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold mb-3" style={{ color: riskColor }}>
            {riskLabel}
          </p>
          <div className="space-y-2.5">
            {[
              {
                label: "Rain",
                value: weather.rain1h > 0 ? `${weather.rain1h}mm/h` : "None",
                icon: <CloudRain className="w-3 h-3" />,
              },
              {
                label: "AQI",
                value: weather.isLoading ? "—" : `${weather.aqi}`,
                icon: <Wind className="w-3 h-3" />,
              },
              {
                label: "Traffic",
                value: traffic.isLoading ? "—" : `${traffic.congestionLevel}%`,
                icon: <Navigation className="w-3 h-3" />,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1.5 text-white/30">
                  {item.icon} {item.label}
                </span>
                <span className="font-semibold text-white/60">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5 flex items-start gap-2">
        <Activity className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/40 leading-relaxed">
          {explanation}
        </p>
      </div>
    </DashCard>
  );
}

// ─── 3. Live Trigger Status Card ──────────────────────────────────────────────
function LiveTriggerStatusCard({
  weather,
  traffic,
}: {
  weather: WeatherData;
  traffic: TrafficData;
}) {
  const triggers = [
    {
      label: "Rainfall",
      value: weather.rain1h > 0 ? `${weather.rain1h}mm/h` : "0mm",
      status: weather.rain1h > 2 ? "ACTIVE" : "INACTIVE",
      icon: "rain",
    },
    {
      label: "AQI Index",
      value: weather.isLoading ? "—" : String(weather.aqi),
      status: weather.aqi > 300 ? "ACTIVE" : "INACTIVE",
      icon: "aqi",
    },
    {
      label: "Traffic",
      value: traffic.isLoading ? "—" : traffic.status,
      status: traffic.congestionLevel > 50 ? "ACTIVE" : "INACTIVE",
      icon: "traffic",
    },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    rain: <CloudRain className="w-4 h-4" />,
    aqi: <Wind className="w-4 h-4" />,
    traffic: <Navigation className="w-4 h-4" />,
  };

  const activeCount = triggers.filter((t) => t.status === "ACTIVE").length;

  return (
    <DashCard className="flex flex-col gap-4 min-h-[360px]" delay={0.15}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Zap className="w-4 h-4" />} label="Trigger Status" />
        <span className="text-[10px] font-semibold text-white/30">
          {activeCount} active
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {triggers.map((t) => {
          const isActive = t.status === "ACTIVE";
          return (
            <motion.div
              key={t.label}
              animate={{
                backgroundColor: isActive
                  ? "rgba(16,185,129,0.05)"
                  : "rgba(255,255,255,0.02)",
                borderColor: isActive
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(255,255,255,0.06)",
              }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between rounded-lg px-4 py-3 border"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-white/5 text-white/20",
                  )}
                >
                  {iconMap[t.icon]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.label}
                  </p>
                  <p className="text-xs text-white/30 font-mono">{t.value}</p>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border",
                  isActive
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : "bg-white/[0.03] border-white/[0.08] text-white/20",
                )}
              >
                {isActive ? "Active" : "Idle"}
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-white/15 text-right font-mono mt-auto">
        {weather.city} · Updated {weather.updatedAt.toLocaleTimeString()}
      </p>
    </DashCard>
  );
}

// ─── 4. Auto Claim Engine Card ─────────────────────────────────────────────────
type ClaimStage = "idle" | "detecting" | "processing" | "approved" | "flagged";

function AutoClaimEngineCard({
  aiScore,
  trigger,
}: {
  aiScore: AIScoringOutput;
  trigger: AIScoringInput["trigger"];
}) {
  const storedLastClaim =
    typeof window !== "undefined"
      ? localStorage.getItem("klaimkavach_last_claim")
      : null;

  const lastClaim = storedLastClaim
    ? (JSON.parse(storedLastClaim) as {
        trigger?: string;
        time?: string;
        trustScore?: number;
        status?: string;
        payout?: number;
      })
    : null;

  const stage: ClaimStage = !lastClaim
    ? "idle"
    : aiScore.decision === "Approved"
      ? "approved"
      : aiScore.decision === "Flagged"
        ? "flagged"
        : aiScore.finalScore >= 60
          ? "processing"
          : "detecting";

  const progress =
    stage === "idle"
      ? 10
      : stage === "detecting"
        ? 35
        : stage === "processing"
          ? 70
          : 100;

  const stageUI: Record<
    ClaimStage,
    { label: string; color: string; desc: string }
  > = {
    idle: {
      label: "Monitoring",
      color: "text-white/40",
      desc: "Watching for trigger conditions",
    },
    detecting: {
      label: "Trigger Detected",
      color: "text-white/60",
      desc: "Validating rain threshold breach",
    },
    processing: {
      label: "AI Processing",
      color: "text-white/60",
      desc: "Cross-checking trust & GPS data",
    },
    approved: {
      label: "Auto Approved",
      color: "text-emerald-500",
      desc: "Payout initiated instantly",
    },
    flagged: {
      label: "Flagged for Review",
      color: "text-amber-500",
      desc: "Suspicious pattern found, manual review required",
    },
  };

  return (
    <DashCard className="flex flex-col gap-4 min-h-[360px]" delay={0.2}>
      <div className="flex items-center justify-between">
        <CardLabel
          icon={<Cpu className="w-4 h-4" />}
          label="Auto Claim Engine"
        />
        <PulseDot />
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Radio className="w-3.5 h-3.5 text-white/20" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Engine Status
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
          >
            <p className={cn("text-sm font-bold mb-0.5", stageUI[stage].color)}>
              {stageUI[stage].label}
            </p>
            <p className="text-[11px] text-white/20">{stageUI[stage].desc}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-white/20"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Last claim grid */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">
          Last Claim
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Trigger", value: lastClaim?.trigger ?? trigger },
            {
              label: "Time",
              value: lastClaim?.time ?? new Date().toLocaleTimeString(),
            },
            {
              label: "Trust Score",
              value: `${Math.round(lastClaim?.trustScore ?? aiScore.trustScore)}/100`,
            },
            {
              label: "Payout",
              value: `₹${Math.round(lastClaim?.payout ?? aiScore.payoutEstimate)}`,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-3 py-2.5"
            >
              <p className="text-[9px] text-white/15 uppercase tracking-wider mb-1">
                {row.label}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-2.5 mt-auto">
        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
        <p className="text-sm font-medium text-emerald-500/80">
          {aiScore.decision === "Approved"
            ? `₹${Math.round(aiScore.payoutEstimate)} auto-credited in <30s`
            : aiScore.decision === "Pending"
              ? "Claim queued for intelligent review"
              : "Claim blocked pending fraud investigation"}
        </p>
        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500/40 ml-auto shrink-0" />
      </div>
    </DashCard>
  );
}

// ─── 5. Trust Score Card ──────────────────────────────────────────────────────
function TrustScoreCard({ aiScore }: { aiScore: AIScoringOutput }) {
  const score = aiScore.trustScore;

  const circ = 2 * Math.PI * 40;
  const offset = circ * (1 - score / 100);

  const checkIcons: Record<string, React.ReactNode> = {
    gps: <MapPin className="w-3.5 h-3.5" />,
    sensor: <Sparkles className="w-3.5 h-3.5" />,
    behavior: <BarChart3 className="w-3.5 h-3.5" />,
  };

  return (
    <DashCard className="flex flex-col gap-4 min-h-[360px]" delay={0.25}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Lock className="w-4 h-4" />} label="Trust Score" />
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/15 text-emerald-500">
          {aiScore.systemConfidence}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="10"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#10b981"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground tabular-nums">
              <AnimatedCounter value={score} />
            </span>
            <span className="text-[9px] text-white/20">/100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {MOCK.trustChecks.map((c) => (
            <div
              key={c.label}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/20">{checkIcons[c.icon]}</span>
                <span className="text-xs text-white/50 font-medium">
                  {c.label}
                </span>
              </div>
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 mt-auto">
        <div className="flex justify-between text-[10px]">
          <span className="text-white/20 font-medium uppercase tracking-wider">
            Fraud Risk
          </span>
          <span className="text-emerald-500 font-semibold">
            {Math.round(aiScore.fraudConfidence)}%
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500/40"
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
    </DashCard>
  );
}

// ─── 6. Smart Alerts Panel ────────────────────────────────────────────────────
let alertIdCounter = 0;
type AlertItem = { id: number; msg: string; type: string; time: string };

function SmartAlertsCard() {
  const [alerts, setAlerts] = useState<AlertItem[]>(() =>
    MOCK.alerts.map((a) => ({ ...a, id: ++alertIdCounter })),
  );
  const [pulse, setPulse] = useState(false);

  const extraMsgs = [
    { msg: "Traffic cleared — Savings maintained", type: "claim" },
    { msg: "Sensor ping confirmed — GPS lock active", type: "claim" },
    { msg: "Risk score dropped — Low risk zone", type: "aqi" },
    { msg: "AI engine recalibrated — Accuracy 99.1%", type: "claim" },
    { msg: "Coverage verified — All conditions met", type: "rain" },
    { msg: "New data feed received — Model updated", type: "claim" },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      const pick = extraMsgs[Math.floor(Math.random() * extraMsgs.length)];
      const newAlert: AlertItem = {
        ...pick,
        time: "Now",
        id: ++alertIdCounter,
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 5));
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  const alertIcon = (type: string) => {
    if (type === "rain")
      return <CloudRain className="w-3.5 h-3.5 text-white/30" />;
    if (type === "aqi") return <Wind className="w-3.5 h-3.5 text-white/30" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-white/30" />;
  };

  const opacityTiers = [1, 0.8, 0.6, 0.4, 0.25];

  return (
    <DashCard
      className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col gap-4"
      delay={0.3}
    >
      <div className="flex items-center justify-between">
        <CardLabel icon={<Bell className="w-4 h-4" />} label="Smart Alerts" />
        <motion.span
          animate={{ scale: pulse ? 1.08 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 bg-white/[0.03] border border-white/10 px-2.5 py-1 rounded-full"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live Feed
        </motion.span>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {alerts.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: opacityTiers[i] ?? 0.25, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{
                opacity: { duration: 0.3 },
                y: { type: "spring", stiffness: 300, damping: 25 },
                scale: { duration: 0.25 },
                layout: { type: "spring", stiffness: 300, damping: 30 },
              }}
              className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-[#1f1f1f] px-3.5 py-3"
            >
              <span className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                {alertIcon(a.type)}
              </span>
              <p className="text-sm text-white/60 font-medium leading-snug flex-1 min-w-0 truncate">
                {a.msg}
              </p>
              <span className="text-[10px] text-white/15 shrink-0 font-mono">
                {a.time}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DashCard>
  );
}

// ─── 7. Earnings Protected Card ───────────────────────────────────────────────
function EarningsProtectedCard() {
  const pastClaims =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("klaimkavach_past_claims") ?? "0")
      : 0;

  const savedFromStorage =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("klaimkavach_total_saved") ?? "0")
      : 0;

  const claimBreakdown =
    typeof window !== "undefined"
      ? (JSON.parse(
          localStorage.getItem("klaimkavach_claim_breakdown") ??
            '{"rain":0,"aqi":0,"traffic":0}',
        ) as { rain?: number; aqi?: number; traffic?: number })
      : { rain: 0, aqi: 0, traffic: 0 };

  const saved = Number.isFinite(savedFromStorage)
    ? Math.max(0, Math.round(savedFromStorage))
    : MOCK.earningsSaved;

  const disruptionsCovered = Math.max(0, pastClaims);

  return (
    <DashCard className="flex flex-col gap-5 min-h-[280px]" delay={0.35}>
      <CardLabel
        icon={<DollarSign className="w-4 h-4" />}
        label="Earnings Protected"
      />

      <div>
        <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 font-medium">
          Saved This Month
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-foreground tabular-nums">
            ₹{saved.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <p className="text-sm text-emerald-500/80 font-medium">
          {disruptionsCovered} disruptions covered
        </p>
      </div>

      {/* Per-category breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-auto">
        {[
          {
            label: "Rain",
            icon: <CloudRain className="w-4 h-4" />,
            val: claimBreakdown.rain ?? 0,
          },
          {
            label: "AQI",
            icon: <Wind className="w-4 h-4" />,
            val: claimBreakdown.aqi ?? 0,
          },
          {
            label: "Traffic",
            icon: <Navigation className="w-4 h-4" />,
            val: claimBreakdown.traffic ?? 0,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] p-3 text-center"
          >
            <span className="text-white/20 flex justify-center mb-1">
              {c.icon}
            </span>
            <p className="text-base font-bold text-foreground">{c.val}</p>
            <p className="text-[10px] text-white/20 font-medium">{c.label}</p>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

// ─── 8. Policy Rules Card ─────────────────────────────────────────────────────
function PolicyRulesCard() {
  return (
    <DashCard
      className="col-span-1 md:col-span-2 xl:col-span-2 flex flex-col gap-4"
      delay={0.4}
    >
      <CardLabel
        icon={<FileText className="w-4 h-4" />}
        label="Policy Rules & Exclusions"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70 mb-2.5">
            Valid Conditions
          </p>
          <div className="space-y-2">
            {MOCK.validConditions.map((v) => (
              <div
                key={v}
                className="flex items-center gap-2.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 px-3.5 py-2.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-sm text-white/50 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">
            Exclusions
          </p>
          <div className="space-y-2">
            {MOCK.exclusions.map((e) => (
              <div
                key={e}
                className="flex items-center gap-2.5 rounded-lg bg-red-500/[0.03] border border-red-500/10 px-3.5 py-2.5"
              >
                <XCircle className="w-3.5 h-3.5 text-red-400/60 shrink-0" />
                <span className="text-sm text-white/30 font-medium">{e}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashCard>
  );
}

// ─── ML Neural Network Card ────────────────────────────────────────────────────
function MLModelCard({ aiScore }: { aiScore: AIScoringOutput }) {
  const [mlStatus, setMlStatus] = useState(getModelStatus);

  useEffect(() => {
    const id = setInterval(() => setMlStatus(getModelStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  const isReady = mlStatus.ready;
  const accuracy = isReady ? mlStatus.accuracy : mlStatus.accuracy;
  const epochProgress = isReady ? 100 : Math.min(100, (mlStatus.epoch / 80) * 100);

  // Neural network layer sizes
  const layers = [
    { label: "Input", size: 12, color: "#6366f1" },
    { label: "Hidden₁", size: 16, color: "#8b5cf6" },
    { label: "Hidden₂", size: 8, color: "#a78bfa" },
    { label: "Output", size: 1, color: "#10b981" },
  ];

  // Top features from ML
  const topFeatures = aiScore.featureContributions.slice(0, 6);
  const maxImpact = Math.max(
    ...aiScore.featureContributions.map((f) => f.absImpact),
    0.01,
  );

  const fraudProb = aiScore.mlPrediction?.fraudProbability ?? (aiScore.fraudConfidence / 100);
  const legitProb = 1 - fraudProb;

  return (
    <DashCard
      className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col gap-5"
      delay={0.28}
    >
      <div className="flex items-center justify-between">
        <CardLabel
          icon={<Brain className="w-4 h-4" />}
          label="ML Neural Network"
        />
        <div className="flex items-center gap-2">
          {isReady ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Model Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Training Epoch {mlStatus.epoch}/80
            </span>
          )}
          <span className="text-[10px] font-mono text-white/20 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            {aiScore.modelType === "hybrid" ? "Hybrid" : aiScore.modelType === "ml" ? "ML" : "Fallback"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Column 1: Architecture Visualization ── */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Architecture: 12→16→8→1
          </p>
          <div className="flex items-center justify-between gap-2 py-3">
            {layers.map((layer, li) => (
              <div key={layer.label} className="flex flex-col items-center gap-1.5">
                {/* Neurons */}
                <div
                  className="flex flex-col items-center gap-0.5"
                  style={{ minHeight: "80px", justifyContent: "center" }}
                >
                  {Array.from({ length: Math.min(layer.size, 6) }).map((_, ni) => (
                    <motion.div
                      key={`n-${li}-${ni}`}
                      className="rounded-full border"
                      style={{
                        width: layer.size === 1 ? 14 : 8,
                        height: layer.size === 1 ? 14 : 8,
                        borderColor: layer.color,
                        backgroundColor: isReady
                          ? `${layer.color}40`
                          : "transparent",
                      }}
                      animate={{
                        opacity: isReady ? 1 : [0.3, 0.8, 0.3],
                        scale: isReady ? 1 : [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: li * 0.15 + ni * 0.05,
                        repeat: isReady ? 0 : Infinity,
                      }}
                    />
                  ))}
                  {layer.size > 6 && (
                    <span className="text-[8px] text-white/20 font-mono">
                      +{layer.size - 6}
                    </span>
                  )}
                </div>
                {/* Connections line */}
                {li < layers.length - 1 && (
                  <div
                    className="absolute"
                    style={{
                      left: `${(li + 0.5) * 25}%`,
                      width: "25%",
                    }}
                  />
                )}
                {/* Label */}
                <span className="text-[9px] text-white/30 font-mono">
                  {layer.label}
                </span>
                <span className="text-[8px] text-white/15 font-mono">
                  {layer.size}n
                </span>
              </div>
            ))}
          </div>

          {/* Connection lines animation */}
          {isReady && (
            <div className="flex items-center gap-1 px-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={`conn-${i}`}
                  className="flex-1 h-px"
                  style={{
                    background: `linear-gradient(90deg, ${layers[i].color}40, ${layers[i + 1].color}40)`,
                  }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{
                    duration: 2,
                    delay: i * 0.3,
                    repeat: Infinity,
                  }}
                />
              ))}
            </div>
          )}

          {/* Model specs */}
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <div className="rounded-md bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
              <p className="text-[8px] text-white/15 uppercase tracking-wider">Activation</p>
              <p className="text-[11px] text-white/50 font-medium">Leaky ReLU</p>
            </div>
            <div className="rounded-md bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
              <p className="text-[8px] text-white/15 uppercase tracking-wider">Optimizer</p>
              <p className="text-[11px] text-white/50 font-medium">SGD + Momentum</p>
            </div>
            <div className="rounded-md bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
              <p className="text-[8px] text-white/15 uppercase tracking-wider">Loss</p>
              <p className="text-[11px] text-white/50 font-medium">Binary BCE</p>
            </div>
            <div className="rounded-md bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
              <p className="text-[8px] text-white/15 uppercase tracking-wider">Training</p>
              <p className="text-[11px] text-white/50 font-medium">500 samples</p>
            </div>
          </div>
        </div>

        {/* ── Column 2: Training Metrics ── */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Training Metrics
          </p>

          {/* Training progress */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-white/30 font-medium">Training Progress</span>
                <span className="text-white/50 font-semibold font-mono">
                  {isReady ? "Complete" : `${Math.round(epochProgress)}%`}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500"
                  animate={{ width: `${epochProgress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-white/30 font-medium">Model Accuracy</span>
                <span className="text-emerald-500 font-semibold font-mono">
                  {(accuracy * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500/60"
                  animate={{ width: `${accuracy * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-white/30 font-medium">Loss (BCE)</span>
                <span className="text-amber-400 font-semibold font-mono">
                  {mlStatus.loss.toFixed(4)}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-amber-500/40"
                  animate={{ width: `${Math.min(100, mlStatus.loss * 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* Fraud probability gauge */}
          <div className="mt-auto rounded-lg bg-white/[0.02] border border-[#1f1f1f] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">
              Real-Time Fraud Probability
            </p>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32" cy="32" r="26"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="32" cy="32" r="26"
                    fill="none"
                    stroke={fraudProb > 0.5 ? "#f87171" : "#10b981"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26}
                    animate={{
                      strokeDashoffset:
                        2 * Math.PI * 26 * (1 - legitProb),
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      fraudProb > 0.5 ? "text-red-400" : "text-emerald-500"
                    }`}
                  >
                    {(legitProb * 100).toFixed(0)}
                  </span>
                  <span className="text-[7px] text-white/20">legit%</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30">Legitimate</span>
                  <span className="text-[10px] text-emerald-500 font-semibold font-mono">
                    {(legitProb * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30">Fraud Risk</span>
                  <span className="text-[10px] text-red-400 font-semibold font-mono">
                    {(fraudProb * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30">Confidence</span>
                  <span className="text-[10px] text-white/50 font-semibold font-mono">
                    {aiScore.mlPrediction
                      ? `${(aiScore.mlPrediction.confidence * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 3: Feature Importance ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
              Feature Importance
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/15 font-medium">
              Perturbation
            </span>
          </div>

          {topFeatures.length > 0 ? (
            <div className="space-y-2">
              {topFeatures.map((fc, i) => {
                const barWidth = Math.max(8, (fc.absImpact / maxImpact) * 100);
                const isFraudSignal = fc.impact > 0;

                return (
                  <div key={fc.featureName} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-white/40 font-medium truncate">
                        {fc.featureName}
                      </span>
                      <span
                        className={`font-mono shrink-0 ml-2 ${
                          isFraudSignal ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {isFraudSignal ? "↑" : "↓"}{" "}
                        {Math.abs(fc.impact).toFixed(3)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          isFraudSignal
                            ? "bg-gradient-to-r from-red-500/30 to-red-500/60"
                            : "bg-gradient-to-r from-emerald-500/30 to-emerald-500/60"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{
                          duration: 0.8,
                          delay: i * 0.08,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-6">
              <p className="text-xs text-white/20">
                {isReady ? "Computing features..." : "Awaiting model training..."}
              </p>
            </div>
          )}

          <p className="text-[9px] text-white/10 mt-auto">
            <span className="text-red-400/60">↑ fraud signal</span>{" "}
            <span className="text-white/10">·</span>{" "}
            <span className="text-emerald-400/60">↓ legit signal</span>{" "}
            <span className="text-white/10">·</span> SHAP-like perturbation
          </p>

          {/* Inference time */}
          <div className="flex items-center gap-2 rounded-md bg-white/[0.03] border border-white/5 px-3 py-2">
            <Cpu className="w-3 h-3 text-white/15" />
            <span className="text-[10px] text-white/30">
              Inference: <span className="text-white/50 font-mono">&lt;1ms</span> in-browser
            </span>
            <span className="text-[10px] text-white/15 ml-auto font-mono">
              {mlStatus.epoch} epochs
            </span>
          </div>
        </div>
      </div>
    </DashCard>
  );
}

// ─── 8b. Auto-Protect Card ────────────────────────────────────────────────────
function AutoProtectCard({
  triggerMonitor,
}: {
  triggerMonitor: ReturnType<typeof useTriggerMonitor>;
}) {
  const { enabled, evaluation, recentAutoClaims, isFiling, lastCheckAt, sessionClaimCount, toggleAutoProtect } = triggerMonitor;

  return (
    <DashCard className="flex flex-col gap-4" delay={0.42}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Radar className="w-4 h-4" />} label="Auto-Protect" />
        <button
          type="button"
          onClick={toggleAutoProtect}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors"
        >
          {enabled ? (
            <>
              <ToggleRight className="w-5 h-5 text-emerald-500" />
              <span className="text-emerald-500">Active</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-5 h-5 text-white/20" />
              <span className="text-white/30">Off</span>
            </>
          )}
        </button>
      </div>

      {enabled ? (
        <>
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">
                Zero-Touch Monitoring
              </span>
            </div>
            <p className="text-sm text-emerald-500/80 font-medium">
              {isFiling
                ? "Filing auto-claim..."
                : evaluation?.isBreached
                  ? `${evaluation.triggers.length} trigger(s) breached — monitoring sustained duration`
                  : "All triggers within safe limits"}
            </p>
            <p className="text-[10px] text-white/15 mt-1 font-mono">
              Last check: {lastCheckAt?.toLocaleTimeString() ?? "—"} · Claims: {sessionClaimCount}
            </p>
          </div>

          {/* Trigger status rows */}
          {evaluation && evaluation.triggers.length > 0 && (
            <div className="space-y-1.5">
              {evaluation.triggers.slice(0, 3).map((t) => (
                <div
                  key={t.rule.id}
                  className="flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2 text-xs"
                >
                  <span className="text-amber-400 font-medium">{t.rule.label}</span>
                  <span className="text-white/40 font-mono">
                    {t.currentValue}{t.rule.unit} / {t.rule.threshold}{t.rule.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recent auto-claims */}
          {recentAutoClaims.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">Recent Auto-Claims</p>
              {recentAutoClaims.slice(0, 2).map((c, i) => (
                <div key={`ac-${i}`} className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-white/40">{c.trigger.rule.label}</span>
                  <span className={c.success ? "text-emerald-500" : "text-red-400"}>
                    {c.success ? `₹${c.payoutAmount ?? 0}` : "Failed"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 px-4 py-6 text-center">
          <p className="text-sm text-white/30">Auto-protect is disabled</p>
          <p className="text-[11px] text-white/15 mt-1">
            Enable to auto-file claims when triggers breach thresholds
          </p>
        </div>
      )}
    </DashCard>
  );
}

// ─── 8c. Disaster Alerts Card ─────────────────────────────────────────────────
function DisasterAlertsCard({
  alerts,
}: {
  alerts: ReturnType<typeof useDisasterAlerts>;
}) {
  const severityColors: Record<string, string> = {
    extreme: "text-red-400 bg-red-500/10 border-red-500/15",
    severe: "text-orange-400 bg-orange-500/10 border-orange-500/15",
    moderate: "text-amber-400 bg-amber-500/10 border-amber-500/15",
    minor: "text-white/40 bg-white/5 border-white/10",
  };

  return (
    <DashCard className="flex flex-col gap-4" delay={0.45}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Globe className="w-4 h-4" />} label="Disaster Alerts" />
        <span className="text-[10px] font-semibold text-white/30">
          {alerts.activeCount} active
        </span>
      </div>

      {alerts.isLoading ? (
        <p className="text-xs text-white/20">Fetching alerts...</p>
      ) : alerts.alerts.length === 0 ? (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
          <p className="text-sm text-emerald-500/80 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> No active disasters in your region
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                severityColors[alert.severity] ?? severityColors.minor,
              )}
            >
              <p className="text-xs font-semibold">{alert.title}</p>
              <p className="text-[10px] opacity-60 mt-0.5 line-clamp-2">
                {alert.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold">
                  {alert.severity}
                </span>
                <span className="text-[9px] opacity-40">· {alert.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

// ─── 8d. Forecast Card ────────────────────────────────────────────────────────
function ForecastCard({
  forecast,
}: {
  forecast: ReturnType<typeof useForecast>;
}) {
  return (
    <DashCard className="flex flex-col gap-4" delay={0.48}>
      <CardLabel icon={<TrendingUp className="w-4 h-4" />} label="24h Forecast" />

      {forecast.isLoading ? (
        <p className="text-xs text-white/20">Loading forecast...</p>
      ) : (
        <>
          {/* Next risk prediction */}
          <div
            className={cn(
              "rounded-lg border px-4 py-3",
              forecast.nextRiskHour !== null && forecast.nextRiskHour <= 3
                ? "bg-amber-500/5 border-amber-500/15"
                : "bg-white/[0.03] border-white/10",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-1">
              Predictive Risk
            </p>
            <p
              className={cn(
                "text-sm font-medium",
                forecast.nextRiskHour !== null && forecast.nextRiskHour <= 3
                  ? "text-amber-400"
                  : "text-white/50",
              )}
            >
              {forecast.nextRiskDescription}
            </p>
          </div>

          {/* Hourly bars */}
          <div className="flex items-end gap-0.5 h-12">
            {forecast.hourly.slice(0, 24).map((h, i) => {
              const height = Math.max(2, (h.precipitationProbability / 100) * 48);
              return (
                <div
                  key={`fh-${i}`}
                  className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${height}px`,
                    backgroundColor: h.isRisky
                      ? "rgba(245,158,11,0.5)"
                      : `rgba(255,255,255,${0.05 + (h.precipitationProbability / 100) * 0.15})`,
                  }}
                  title={`${h.hour}:00 — ${h.precipitationProbability}% rain, ${h.temperature}°C`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-white/15">
            <span>Now</span>
            <span>+12h</span>
            <span>+24h</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] p-2.5">
              <p className="text-[9px] text-white/15 uppercase tracking-wider mb-1">Peak Rain %</p>
              <p className="text-sm font-bold text-foreground">{forecast.peakRainProbability}%</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] p-2.5">
              <p className="text-[9px] text-white/15 uppercase tracking-wider mb-1">Avg Risk</p>
              <p className="text-sm font-bold text-foreground">{forecast.averageRisk}/100</p>
            </div>
          </div>
        </>
      )}
    </DashCard>
  );
}

// ─── 8e. Hyper-Local Risk Card ────────────────────────────────────────────────
function HyperLocalRiskCard({ lat, lng }: { lat: number; lng: number }) {
  const profile = getHyperLocalRisk(lat, lng);

  return (
    <DashCard className="flex flex-col gap-4" delay={0.5}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<MapPin className="w-4 h-4" />} label="Micro-Zone Risk" />
        {profile.matched && (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40">
            {profile.zone?.pincode}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">{profile.localityLabel}</p>
        {profile.zone && (
          <p className="text-[11px] text-white/30 mt-0.5">{profile.zone.ward} · {profile.distanceKm}km</p>
        )}
      </div>

      {/* Risk multiplier */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Rain", value: `${profile.rainSensitivity}×`, icon: <CloudRain className="w-3 h-3" /> },
          { label: "AQI", value: `${profile.aqiSensitivity}×`, icon: <Wind className="w-3 h-3" /> },
          { label: "Traffic", value: `${profile.trafficSensitivity}×`, icon: <Navigation className="w-3 h-3" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] p-2.5 text-center">
            <span className="text-white/20 flex justify-center mb-1">{item.icon}</span>
            <p className="text-sm font-bold text-foreground">{item.value}</p>
            <p className="text-[9px] text-white/15">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Hazards */}
      {profile.activeHazards.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">Known Hazards</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.activeHazards.map((h) => (
              <span
                key={h}
                className="inline-flex px-2 py-1 rounded-md bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400/70 font-medium"
              >
                {getHazardLabel(h)}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.historicalClaimDensity > 0 && (
        <p className="text-[10px] text-white/15 font-mono mt-auto">
          Historical density: {profile.historicalClaimDensity} claims/1k users/month
        </p>
      )}
    </DashCard>
  );
}

// ─── System Health Bar ─────────────────────────────────────────────────────────
function SystemHealthBar() {
  const [mlStatus, setMlStatus] = useState(getModelStatus);

  useEffect(() => {
    const id = setInterval(() => setMlStatus(getModelStatus()), 2000);
    return () => clearInterval(id);
  }, []);

  const systemItems = [
    {
      label: mlStatus.ready ? "ML Model" : "ML Training",
      status: mlStatus.ready ? "Active" : `Epoch ${mlStatus.epoch}`,
      pct: mlStatus.ready ? Math.round(mlStatus.accuracy * 100) : Math.min(95, mlStatus.epoch),
    },
    { label: "Data Feed", status: "Live", pct: 100 },
    { label: "Trigger Engine", status: "Active", pct: 99 },
    { label: "Claim API", status: "Active", pct: 97 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 rounded-xl border border-[#1f1f1f] bg-[#111] mb-6">
      <Wifi className="w-3.5 h-3.5 text-white/20 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mr-1">
        System
      </span>
      {systemItems.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              s.pct >= 98 ? "bg-emerald-500" : s.pct >= 80 ? "bg-amber-400" : "bg-white/30 animate-pulse",
            )}
          />
          <span className="text-[11px] font-medium text-white/40">
            {s.label}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold",
              s.pct >= 98 ? "text-emerald-500/70" : s.pct >= 80 ? "text-amber-400/70" : "text-white/30",
            )}
          >
            {s.pct}%
          </span>
        </div>
      ))}
      {mlStatus.ready && (
        <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15">
          <Brain className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-semibold text-emerald-500">Neural Net</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1.5 text-white/15">
        <RefreshCw
          className="w-3 h-3 animate-spin"
          style={{ animationDuration: "3s" }}
        />
        <span className="text-[10px] font-mono">Live sync</span>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectedPlan, user } = useAuth();
  const [time, setTime] = useState(new Date());
  const weather = useWeather();
  const traffic = useTraffic();
  const triggerMonitor = useTriggerMonitor(weather, traffic);
  const disasterAlerts = useDisasterAlerts(weather.lat, weather.lon);
  const forecast = useForecast(weather.lat, weather.lon);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/register");
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!isAuthenticated) return null;

  const displayName = user?.split(" ")[0] || "Gig";

  if (!selectedPlan) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-10 pb-24 md:pb-10 relative">
        <Helmet>
          <title>Dashboard | KlaimKavach</title>
          <meta
            name="description"
            content="Your insurance dashboard. Choose a plan from pricing to activate coverage."
          />
        </Helmet>

        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-b border-[#1f1f1f] pb-6 pt-2"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
              Welcome, <span className="text-white/40">{displayName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your account is ready, but no insurance plan is active yet.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#111] px-5 py-3">
            <PulseDot size="md" />
            <div>
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">
                Account Status
              </p>
              <p className="text-base font-semibold text-foreground">No Plan</p>
            </div>
          </div>
        </motion.header>

        <DashCard className="max-w-3xl mx-auto mt-8 p-8" delay={0.08}>
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#2a2a2a] bg-[#1a1a1a] text-white/40 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-white/30 font-semibold mb-1">
                No Active Coverage
              </p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                Pick a plan to activate your dashboard insights
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                You are signed in successfully. To start claim protection, risk
                monitoring, and auto payouts, buy a plan from the Pricing tab.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLocation("/pricing")}
            className="inline-flex items-center gap-2 rounded-lg bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Go to Pricing
            <ArrowRight className="w-4 h-4" />
          </button>
        </DashCard>
      </div>
    );
  }

  const planDetails = plansById[selectedPlan as PlanId];
  const coverageLabelByPlan: Record<PlanId, string> = {
    basic: "Low Coverage",
    pro: "Medium Coverage",
    elite: "High Coverage",
  };

  const pastClaims = Number(
    localStorage.getItem("klaimkavach_past_claims") ?? "0",
  );
  const approvalRate = Number(
    localStorage.getItem("klaimkavach_approval_rate") ?? "80",
  );
  const fraudFlags = Number(
    localStorage.getItem("klaimkavach_fraud_flags") ?? "0",
  );

  const trigger: AIScoringInput["trigger"] =
    traffic.congestionLevel > 50
      ? "Traffic Jam"
      : weather.rain1h > 1
        ? "Heavy Rain"
        : "Poor AQI";

  const consistency: AIScoringInput["consistency"] =
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
    rainIntensity: weather.rain1h,
    aqiLevel: weather.aqi,
    trafficCongestion: traffic.congestionLevel,
  });

  const liveRisk = computeLiveRiskSnapshot(weather, traffic);

  // Dynamic stats from real weather and traffic data
  const riskScore = liveRisk.score;
  const riskLabel = liveRisk.label;
  const activeTrigs = [
    weather.rain1h > 2,
    weather.aqi > 300,
    traffic.congestionLevel > 50,
  ].filter(Boolean).length;

  const statItems = [
    {
      label: "Risk Level",
      value: riskLabel,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    {
      label: "Trust Score",
      value: `${aiScore.trustScore}/100`,
      icon: <Lock className="w-3.5 h-3.5" />,
    },
    {
      label: "Coverage",
      value: `${coverageLabelByPlan[selectedPlan as PlanId]} (${planDetails.name})`,
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    {
      label: "Triggers Active",
      value: `${activeTrigs} / 3`,
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      label: "AQI",
      value: weather.isLoading ? "—" : `${weather.aqi}`,
      icon: <Wind className="w-3.5 h-3.5" />,
    },
    {
      label: "Traffic",
      value: traffic.isLoading ? "—" : `${traffic.status}`,
      icon: <Navigation className="w-3.5 h-3.5" />,
    },
    {
      label: "Location",
      value: weather.city,
      icon: <MapPin className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-10 pb-24 md:pb-10 relative">
      <Helmet>
        <title>Dashboard | KlaimKavach – AI Insurance Engine</title>
        <meta
          name="description"
          content="Real-time AI insurance dashboard for gig workers — monitor coverage, risk, claims and trust score live."
        />
      </Helmet>

      {/* ── Ambient BG ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-3xl" />
      </div>

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-b border-[#1f1f1f] pb-6 pt-2"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/40 font-medium tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ML-Powered Insurance Engine — Active
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/15 bg-emerald-500/5 text-[10px] text-emerald-500/70 font-medium tracking-widest uppercase">
              <Radar className="w-3 h-3" />
              Zero-Touch Parametric
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            Welcome back, <span className="text-white/40">{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            ML-powered parametric insurance engine monitoring you{" "}
            <span className="text-foreground font-semibold">24/7</span>. Zero-touch
            auto-claims active.
          </p>
        </div>

        {/* Live sync badge */}
        <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#111] px-5 py-3">
          <PulseDot size="md" />
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">
              Live Sync
            </p>
            <p className="text-base font-mono font-bold text-foreground tabular-nums">
              {time.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </motion.header>

      {/* ── API Error Banner ── */}
      <AnimatePresence>
        {weather.error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-200/80 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <p>{weather.error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── System health bar ── */}
      <SystemHealthBar />

      {/* ── Stats row ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6"
      >
        {statItems.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-[#1f1f1f] bg-[#111] px-4 py-3.5 flex items-center gap-3 hover:border-[#2a2a2a] transition-all duration-200"
          >
            <span className="shrink-0 text-white/30">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-[9px] text-white/20 uppercase tracking-wider font-semibold truncate">
                {s.label}
              </p>
              <p className="text-sm font-bold text-foreground truncate">
                {s.value}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main card grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ActiveCoverageCard
          weather={weather}
          traffic={traffic}
          currentPlan={planDetails}
        />
        <LiveRiskScoreCard
          weather={weather}
          traffic={traffic}
          liveRisk={liveRisk}
        />

        <LiveTriggerStatusCard weather={weather} traffic={traffic} />
        <AutoClaimEngineCard aiScore={aiScore} trigger={trigger} />
        <TrustScoreCard aiScore={aiScore} />

        {/* ── ML Neural Network Card (Full Width) ── */}
        <MLModelCard aiScore={aiScore} />

        <SmartAlertsCard />

        <AutoProtectCard triggerMonitor={triggerMonitor} />
        <DisasterAlertsCard alerts={disasterAlerts} />
        <ForecastCard forecast={forecast} />
        <HyperLocalRiskCard lat={weather.lat} lng={weather.lon} />

        <PolicyRulesCard />
        <EarningsProtectedCard />
      </div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 flex items-center justify-center gap-2 text-white/15 text-xs"
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          Neural network + parametric triggers · KlaimKavach ML Engine v3.0
        </span>
        <Brain className="w-3.5 h-3.5 text-emerald-500/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </motion.div>
    </div>
  );
}
