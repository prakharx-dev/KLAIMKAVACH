import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { plansById } from "@/lib/plans";
import {
  useGetDashboard,
  useCheckDisruption,
  getCheckDisruptionQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Shield,
  CloudRain,
  Activity,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

import { Card } from "@/components/card";
import { Modal } from "@/components/modal";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectedPlan } = useAuth();
  const { data: dashboard, isLoading } = useGetDashboard();
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/register");
      return;
    }

    if (!selectedPlan) {
      setLocation("/pricing");
    }
  }, [isAuthenticated, selectedPlan, setLocation]);

  if (!isAuthenticated || !selectedPlan) return null;

  const activePlan = plansById[selectedPlan];

  const {
    data: disruptionData,
    isLoading: isCheckingDisruption,
    refetch: checkDisruption,
  } = useCheckDisruption({
    query: { enabled: false, queryKey: getCheckDisruptionQueryKey() }, // Only run when button is clicked
  });

  const handleCheckDisruption = async () => {
    setIsDisruptionModalOpen(true);
    await checkDisruption();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-card" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 bg-card rounded-xl" />
          <Skeleton className="h-48 bg-card rounded-xl" />
          <Skeleton className="h-48 bg-card rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  // Determine risk color
  const riskColor =
    dashboard.riskScore < 30
      ? "text-emerald-500"
      : dashboard.riskScore <= 70
        ? "text-amber-500"
        : "text-destructive";

  const riskBg =
    dashboard.riskScore < 30
      ? "bg-emerald-500"
      : dashboard.riskScore <= 70
        ? "bg-amber-500"
        : "bg-destructive";

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <Helmet>
        <title>Dashboard | KlaimKavach</title>
      </Helmet>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
          >
            Welcome back, {dashboard.userName?.split(" ")[0] || "User"}
          </motion.h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Overview of your current coverage.
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Live sync
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Premium Card */}
        <Card className="col-span-1 lg:col-span-2 p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-12">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="px-3 py-1 rounded-full border border-border text-xs font-semibold tracking-widest uppercase text-foreground">
              Active Coverage
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Weekly Premium
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
                ₹{activePlan.weeklyPremium}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              {activePlan.name} coverage: {activePlan.coverage}
            </p>
          </div>
        </Card>

        {/* Risk Score Card */}
        <Card className="p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live Risk Score
            </h3>
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="mt-8 mb-4">
            <div className="flex items-end gap-3 mb-4">
              <span className="text-6xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                {dashboard.riskScore}
              </span>
              <span
                className={`text-sm font-semibold uppercase tracking-widest ${riskColor} mb-1`}
              >
                {dashboard.riskLevel}
              </span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${riskBg}`}
                initial={{ width: 0 }}
                animate={{ width: `${dashboard.riskScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-4">
            Powered by AI Telematics
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          interactive
          className="p-6 flex flex-col gap-4"
          onClick={() => setLocation("/fraud")}
        >
          <div className="flex justify-between">
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Active Plan
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {activePlan.name}
            </p>
          </div>
        </Card>

        <Card
          interactive
          className="p-6 flex flex-col gap-4"
          onClick={() => setLocation("/claim")}
        >
          <div className="flex justify-between">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Total Claims
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {dashboard.totalClaims}
            </p>
          </div>
        </Card>

        <Button
          onClick={handleCheckDisruption}
          className="h-auto p-6 col-span-1 sm:col-span-2 bg-card hover:bg-secondary border border-border justify-between group rounded-xl shadow-sm text-foreground flex-row items-center"
          variant="outline"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <CloudRain className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Weather & Traffic
              </p>
              <p className="text-lg font-semibold text-foreground">
                Check Disruptions
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Button>
      </div>

      {/* Disruption Modal */}
      <Modal
        isOpen={isDisruptionModalOpen}
        onClose={() => setIsDisruptionModalOpen(false)}
      >
        {isCheckingDisruption ? (
          <div className="flex flex-col items-center py-8 text-center space-y-4">
            <Loader className="w-8 h-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mt-4">
              Scanning route...
            </h3>
            <p className="text-sm text-muted-foreground">
              Analyzing weather and traffic data.
            </p>
          </div>
        ) : disruptionData ? (
          <div className="flex flex-col items-center text-center">
            {disruptionData.hasDisruption ? (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">
                  Disruption Detected
                </h3>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-widest mb-4">
                  {disruptionData.type} • {disruptionData.severity}
                </div>
                <p className="text-sm text-muted-foreground mb-8">
                  {disruptionData.message}
                </p>

                {disruptionData.eligibleForClaim && (
                  <div className="w-full space-y-3">
                    <Button
                      className="w-full h-10"
                      onClick={() => setLocation("/claim")}
                    >
                      File a Claim
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full h-10"
                      onClick={() => setIsDisruptionModalOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">
                  All Clear
                </h3>
                <p className="text-sm text-muted-foreground mb-8">
                  {disruptionData.message ||
                    "No active weather or traffic disruptions in your zone."}
                </p>
                <Button
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => setIsDisruptionModalOpen(false)}
                >
                  Close
                </Button>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
