import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import {
  calculateTrustScore,
  fetchTrustScoreFromApi,
  getCurrentCoordinates,
  getPublicIpAddress,
} from "@/lib/trust-score";

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
  const [isLoading, setIsLoading] = useState(true);
  const [fraudData, setFraudData] = useState<{
    trustScore: number;
    status: string;
    label: string;
    details: string;
  } | null>(null);
  const [telematicsText, setTelematicsText] = useState(
    "Collecting GPS and IP signals...",
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/register");
      return;
    }

    let isMounted = true;

    const loadTrustSignals = async () => {
      setIsLoading(true);

      const [coordinates, ipAddress] = await Promise.all([
        getCurrentCoordinates(),
        getPublicIpAddress(),
      ]);

      if (!isMounted) return;

      const trustInput = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        ipAddress,
      };

      const trust =
        (await fetchTrustScoreFromApi(trustInput)) ??
        calculateTrustScore(trustInput);

      setFraudData({
        trustScore: trust.score,
        status: trust.status,
        label: trust.label,
        details: trust.details,
      });

      const hasGps =
        typeof coordinates.latitude === "number" &&
        typeof coordinates.longitude === "number";
      const hasIp = !!ipAddress;

      if (hasGps && hasIp) {
        setTelematicsText("GPS + IP verified and active");
      } else if (hasGps || hasIp) {
        setTelematicsText("Partial telemetry detected");
      } else {
        setTelematicsText("Telemetry unavailable");
      }

      setIsLoading(false);
    };

    loadTrustSignals();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto w-full space-y-6">
        <Skeleton className="h-8 w-48 bg-card" />
        <Skeleton className="h-[300px] w-full rounded-xl bg-card" />
      </div>
    );
  }

  if (!fraudData) return null;

  const isVerified = fraudData.trustScore > 70;
  const isSuspicious = fraudData.trustScore <= 70 && fraudData.trustScore >= 30;
  const isFraud = fraudData.trustScore < 30;

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

  return (
    <div className="max-w-xl mx-auto w-full space-y-8 pb-20">
      <div className="border-b border-border pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Trust Score
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                AI analyzes trip history, GPS telematics, and previous claim
                patterns to generate your trust score. High scores ensure
                instant payouts.
              </TooltipContent>
            </Tooltip>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time fraud prevention engine.
          </p>
        </div>
      </div>

      <Card className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
        <div
          className={`w-16 h-16 rounded-full ${bgClass}/10 flex items-center justify-center mb-8`}
        >
          <ColorIcon className={`w-8 h-8 ${colorClass}`} />
        </div>

        <div className="w-full max-w-sm mb-10 relative">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span>High Risk</span>
            <span>Verified</span>
          </div>

          <div className="h-1 bg-secondary rounded-full overflow-hidden relative">
            <motion.div
              className={`h-full ${bgClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${fraudData.trustScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex flex-col items-center"
          >
            <div className="flex items-baseline gap-1">
              <span
                className={`text-6xl font-bold tracking-tight tabular-nums ${colorClass}`}
              >
                {fraudData.trustScore}
              </span>
              <span className="text-muted-foreground text-xl">/100</span>
            </div>
          </motion.div>
        </div>

        <div className="mt-4 pt-8 border-t border-border w-full text-left">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground mb-2">
            {fraudData.label}
          </h3>
          <p className="text-muted-foreground text-sm">
            {fraudData.details ||
              "Your account is in good standing. Claims under ₹2,000 will be processed instantly."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">
            Status
          </p>
          <p className="text-sm text-foreground font-medium capitalize">
            {fraudData.status}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">
            Telematics Auth
          </p>
          <p className="text-sm text-emerald-500 font-medium">
            {telematicsText}
          </p>
        </div>
      </div>
    </div>
  );
}
