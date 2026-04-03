import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWeather, type WeatherData } from "@/hooks/use-weather";
import { useTraffic, type TrafficData } from "@/hooks/use-traffic";
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
    { msg: "Heavy rain detected — You are covered", type: "rain", time: "2:10 PM" },
    { msg: "Claim auto-triggered — ₹150 credited", type: "claim", time: "2:11 PM" },
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

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = display;
    startTimeRef.current = null;
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(startRef.current + (value - startRef.current) * eased));
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
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-emerald-500")} />
      <span className={cn("relative inline-flex rounded-full bg-emerald-500", sz)} />
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
        className
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
      <p className="text-xs font-semibold uppercase tracking-widest text-white/30">{label}</p>
    </div>
  );
}

// ─── 1. Active Coverage Card ───────────────────────────────────────────────────
function ActiveCoverageCard({ weather, traffic }: { weather: WeatherData; traffic: TrafficData }) {
  const coverageIcons: Record<string, React.ReactNode> = {
    Rain: <CloudRain className="w-3 h-3" />,
    AQI: <Wind className="w-3 h-3" />,
    Traffic: <Navigation className="w-3 h-3" />,
  };

  // Generate dynamic next-risk based on real weather and traffic
  const nextRiskMsg = weather.rain1h > 0
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
    <DashCard className="col-span-1 lg:col-span-2 xl:col-span-2 flex flex-col gap-5" delay={0.05}>
      <div className="flex items-start justify-between">
        <CardLabel icon={<Shield className="w-4 h-4" />} label="Active Coverage" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <PulseDot />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Protected</span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-1">Weekly Premium</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">₹99</span>
            <span className="text-white/30 text-sm font-medium">/week</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1">Plan</p>
          <span className="text-lg font-bold text-foreground">Elite</span>
        </div>
      </div>

      {/* Coverage tags */}
      <div className="flex flex-wrap gap-2">
        {MOCK.coverage.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-medium"
          >
            {coverageIcons[c]} {c}
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
            {weather.city} · {weather.temp}°C · Updated {weather.updatedAt.toLocaleTimeString()}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/15 shrink-0" />
      </div>
    </DashCard>
  );
}

// ─── 2. Live Risk Score Card ───────────────────────────────────────────────────
function LiveRiskScoreCard({ weather, traffic }: { weather: WeatherData; traffic: TrafficData }) {
  // Compute risk score from real weather and traffic data
  const rainRisk = Math.min(100, weather.rain1h * 10); // 10mm = 100% rain risk
  const aqiRisk = Math.min(100, (weather.aqi / 500) * 100);
  const trafficRisk = traffic.congestionLevel;
  const score = Math.round((rainRisk * 0.35 + aqiRisk * 0.35 + trafficRisk * 0.3));

  // Dynamic explanation based on real data
  const explanation = weather.isLoading || traffic.isLoading
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

  const riskColor = score < 30 ? "#10b981" : score <= 60 ? "#f59e0b" : "#ef4444";
  const riskLabel = score < 30 ? "Low Risk" : score <= 60 ? "Medium Risk" : "High Risk";

  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <DashCard className="flex flex-col gap-4" delay={0.1}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Activity className="w-4 h-4" />} label="Live Risk Score" />
        <PulseDot />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-28 h-28 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r={r}
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
              { label: "Rain", value: weather.rain1h > 0 ? `${weather.rain1h}mm/h` : "None", icon: <CloudRain className="w-3 h-3" /> },
              { label: "AQI", value: weather.isLoading ? "—" : `${weather.aqi}`, icon: <Wind className="w-3 h-3" /> },
              { label: "Traffic", value: traffic.isLoading ? "—" : `${traffic.congestionLevel}%`, icon: <Navigation className="w-3 h-3" /> },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white/30">
                  {item.icon} {item.label}
                </span>
                <span className="font-semibold text-white/60">{item.value}</span>
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
function LiveTriggerStatusCard({ weather, traffic }: { weather: WeatherData; traffic: TrafficData }) {
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
        <span className="text-[10px] font-semibold text-white/30">{activeCount} active</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {triggers.map((t) => {
          const isActive = t.status === "ACTIVE";
          return (
            <motion.div
              key={t.label}
              animate={{
                backgroundColor: isActive ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.02)",
                borderColor: isActive ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
              }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between rounded-lg px-4 py-3 border"
            >
              <div className="flex items-center gap-3">
                <span className={cn("p-1.5 rounded-md transition-colors", isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-white/20")}>
                  {iconMap[t.icon]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.label}</p>
                  <p className="text-xs text-white/30 font-mono">{t.value}</p>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border",
                  isActive
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : "bg-white/[0.03] border-white/[0.08] text-white/20"
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
const CLAIM_STAGES = ["idle", "detecting", "processing", "approved"] as const;
type ClaimStage = typeof CLAIM_STAGES[number];

function AutoClaimEngineCard() {
  const [stage, setStage] = useState<ClaimStage>("approved");
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let i = CLAIM_STAGES.indexOf("approved");
    const id = setInterval(() => {
      i = (i + 1) % CLAIM_STAGES.length;
      setStage(CLAIM_STAGES[i]);
      setProgress(i === 0 ? 0 : i === 1 ? 33 : i === 2 ? 66 : 100);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const stageUI: Record<ClaimStage, { label: string; color: string; desc: string }> = {
    idle: { label: "Monitoring", color: "text-white/40", desc: "Watching for trigger conditions" },
    detecting: { label: "Trigger Detected", color: "text-white/60", desc: "Validating rain threshold breach" },
    processing: { label: "AI Processing", color: "text-white/60", desc: "Cross-checking trust & GPS data" },
    approved: { label: "Auto Approved", color: "text-emerald-500", desc: "Payout initiated instantly" },
  };

  return (
    <DashCard className="flex flex-col gap-4 min-h-[360px]" delay={0.2}>
      <div className="flex items-center justify-between">
        <CardLabel icon={<Cpu className="w-4 h-4" />} label="Auto Claim Engine" />
        <PulseDot />
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Radio className="w-3.5 h-3.5 text-white/20" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Engine Status</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={stage} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}>
            <p className={cn("text-sm font-bold mb-0.5", stageUI[stage].color)}>{stageUI[stage].label}</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">Last Claim</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Trigger", value: MOCK.lastClaim.trigger },
            { label: "Time", value: MOCK.lastClaim.time },
            { label: "Trust Score", value: `${MOCK.lastClaim.trustScore}/100` },
            { label: "Payout", value: `₹${MOCK.lastClaim.payout}` },
          ].map((row) => (
            <div key={row.label} className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-3 py-2.5">
              <p className="text-[9px] text-white/15 uppercase tracking-wider mb-1">{row.label}</p>
              <p className="text-sm font-semibold text-foreground truncate">{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-2.5 mt-auto">
        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
        <p className="text-sm font-medium text-emerald-500/80">₹150 auto-credited in &lt;30s</p>
        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500/40 ml-auto shrink-0" />
      </div>
    </DashCard>
  );
}

// ─── 5. Trust Score Card ──────────────────────────────────────────────────────
function TrustScoreCard() {
  const [score, setScore] = useState(MOCK.trustScore);

  useEffect(() => {
    const id = setInterval(() => {
      setScore((s) => Math.max(72, Math.min(100, s + Math.floor(Math.random() * 5) - 2)));
    }, 4500);
    return () => clearInterval(id);
  }, []);

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
          Verified
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            <motion.circle
              cx="50" cy="50" r="40"
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
            <div key={c.label} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-[#1f1f1f] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-white/20">{checkIcons[c.icon]}</span>
                <span className="text-xs text-white/50 font-medium">{c.label}</span>
              </div>
              {c.ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <XCircle className="w-4 h-4 text-red-400" />}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 mt-auto">
        <div className="flex justify-between text-[10px]">
          <span className="text-white/20 font-medium uppercase tracking-wider">Fraud Risk</span>
          <span className="text-emerald-500 font-semibold">Very Low</span>
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
    MOCK.alerts.map((a) => ({ ...a, id: ++alertIdCounter }))
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
      const newAlert: AlertItem = { ...pick, time: "Now", id: ++alertIdCounter };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 5));
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  const alertIcon = (type: string) => {
    if (type === "rain") return <CloudRain className="w-3.5 h-3.5 text-white/30" />;
    if (type === "aqi") return <Wind className="w-3.5 h-3.5 text-white/30" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-white/30" />;
  };

  const opacityTiers = [1, 0.8, 0.6, 0.4, 0.25];

  return (
    <DashCard className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col gap-4" delay={0.3}>
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
              <p className="text-sm text-white/60 font-medium leading-snug flex-1 min-w-0 truncate">{a.msg}</p>
              <span className="text-[10px] text-white/15 shrink-0 font-mono">{a.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DashCard>
  );
}

// ─── 7. Earnings Protected Card ───────────────────────────────────────────────
function EarningsProtectedCard() {
  const [saved, setSaved] = useState(MOCK.earningsSaved);

  useEffect(() => {
    const id = setInterval(() => {
      setSaved((s) => s + Math.floor(Math.random() * 8));
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <DashCard className="flex flex-col gap-5 min-h-[280px]" delay={0.35}>
      <CardLabel icon={<DollarSign className="w-4 h-4" />} label="Earnings Protected" />

      <div>
        <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 font-medium">Saved This Month</p>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-foreground tabular-nums">₹<AnimatedCounter value={saved} /></span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <p className="text-sm text-emerald-500/80 font-medium">{MOCK.disruptionsCovered} disruptions covered</p>
      </div>

      {/* Per-category breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-auto">
        {[
          { label: "Rain", icon: <CloudRain className="w-4 h-4" />, val: 1 },
          { label: "AQI", icon: <Wind className="w-4 h-4" />, val: 1 },
          { label: "Traffic", icon: <Navigation className="w-4 h-4" />, val: 1 },
        ].map((c) => (
          <div key={c.label} className="rounded-lg bg-white/[0.03] border border-[#1f1f1f] p-3 text-center">
            <span className="text-white/20 flex justify-center mb-1">{c.icon}</span>
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
    <DashCard className="col-span-1 md:col-span-2 xl:col-span-2 flex flex-col gap-4" delay={0.4}>
      <CardLabel icon={<FileText className="w-4 h-4" />} label="Policy Rules & Exclusions" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70 mb-2.5">Valid Conditions</p>
          <div className="space-y-2">
            {MOCK.validConditions.map((v) => (
              <div key={v} className="flex items-center gap-2.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 px-3.5 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-sm text-white/50 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Exclusions</p>
          <div className="space-y-2">
            {MOCK.exclusions.map((e) => (
              <div key={e} className="flex items-center gap-2.5 rounded-lg bg-red-500/[0.03] border border-red-500/10 px-3.5 py-2.5">
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

// ─── System Health Bar ─────────────────────────────────────────────────────────
function SystemHealthBar() {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 rounded-xl border border-[#1f1f1f] bg-[#111] mb-6">
      <Wifi className="w-3.5 h-3.5 text-white/20 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mr-1">System</span>
      {MOCK.systemHealth.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", s.pct >= 98 ? "bg-emerald-500" : "bg-amber-400")} />
          <span className="text-[11px] font-medium text-white/40">{s.label}</span>
          <span className={cn("text-[10px] font-semibold", s.pct >= 98 ? "text-emerald-500/70" : "text-amber-400/70")}>{s.pct}%</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1.5 text-white/15">
        <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} />
        <span className="text-[10px] font-mono">Syncing every 2.5s</span>
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

  useEffect(() => {
    if (!isAuthenticated) { setLocation("/register"); return; }
    if (!selectedPlan) { setLocation("/pricing"); }
  }, [isAuthenticated, selectedPlan, setLocation]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!isAuthenticated || !selectedPlan) return null;

  const displayName = user?.split(" ")[0] || "Gig";

  // Dynamic stats from real weather and traffic data
  const rainRisk = Math.min(100, weather.rain1h * 10);
  const aqiRisk = Math.min(100, (weather.aqi / 500) * 100);
  const trafficRisk = traffic.congestionLevel;
  const riskScore = Math.round(rainRisk * 0.35 + aqiRisk * 0.35 + trafficRisk * 0.3);
  const riskLabel = riskScore < 30 ? "Low" : riskScore <= 60 ? "Medium" : "High";
  const activeTrigs = [weather.rain1h > 2, weather.aqi > 300, traffic.congestionLevel > 50].filter(Boolean).length;

  const statItems = [
    { label: "Risk Level", value: riskLabel, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { label: "Coverage", value: "Elite Plan", icon: <Shield className="w-3.5 h-3.5" /> },
    { label: "Triggers Active", value: `${activeTrigs} / 3`, icon: <Zap className="w-3.5 h-3.5" /> },
    { label: "AQI", value: weather.isLoading ? "—" : `${weather.aqi}`, icon: <Wind className="w-3.5 h-3.5" /> },
    { label: "Traffic", value: traffic.isLoading ? "—" : `${traffic.status}`, icon: <Navigation className="w-3.5 h-3.5" /> },
    { label: "Location", value: weather.city, icon: <MapPin className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-10 pb-24 md:pb-10 relative">
      <Helmet>
        <title>Dashboard | KlaimKavach – AI Insurance Engine</title>
        <meta name="description" content="Real-time AI insurance dashboard for gig workers — monitor coverage, risk, claims and trust score live." />
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
              AI Insurance Engine — Active
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            Welcome back,{" "}
            <span className="text-white/40">
              {displayName}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            KlaimKavach AI is monitoring you{" "}
            <span className="text-foreground font-semibold">24/7</span>. All systems operational.
          </p>
        </div>

        {/* Live sync badge */}
        <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#111] px-5 py-3">
          <PulseDot size="md" />
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Live Sync</p>
            <p className="text-base font-mono font-bold text-foreground tabular-nums">{time.toLocaleTimeString()}</p>
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
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
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
              <p className="text-[9px] text-white/20 uppercase tracking-wider font-semibold truncate">{s.label}</p>
              <p className="text-sm font-bold text-foreground truncate">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main card grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ActiveCoverageCard weather={weather} traffic={traffic} />
        <LiveRiskScoreCard weather={weather} traffic={traffic} />

        <LiveTriggerStatusCard weather={weather} traffic={traffic} />
        <AutoClaimEngineCard />
        <TrustScoreCard />

        <SmartAlertsCard />

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
        <span>Data refreshes every 2.5s · Powered by KlaimKavach AI Engine v2.1</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </motion.div>
    </div>
  );
}
