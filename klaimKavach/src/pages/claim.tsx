import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { plansById } from "@/lib/plans";
import { motion, AnimatePresence } from "framer-motion";
import { useSubmitClaim } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  FileText,
  CheckCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { Card } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function Claim() {
  const [hours, setHours] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectedPlan } = useAuth();
  const { toast } = useToast();

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

  const {
    mutate: submitClaim,
    isPending,
    data: successData,
  } = useSubmitClaim();

  const totalPayout = hours * payoutPerHour;

  const handleSubmit = () => {
    submitClaim(
      {
        data: {
          hoursLost: hours,
          reason: reason || "Heavy Rain / Disruption",
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Claim submitted",
            description: "Your claim was submitted successfully.",
          });
        },
        onError: (error: any) => {
          toast({
            title: "Claim failed",
            description:
              error?.message ||
              "Could not submit claim. Please try again in a few seconds.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (successData?.success) {
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
              Claim Approved
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
                <span className="text-emerald-500 font-medium">
                  Processing Payment
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
    <div className="max-w-xl w-full space-y-8 mx-auto">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          File a Claim
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Calculate and submit your lost hours instantly.
        </p>
        <p className="text-xs text-emerald-400 mt-2 uppercase tracking-widest font-medium">
          Active plan: {activePlan.name} ({activePlan.coverage})
        </p>
      </div>

      <Card className="p-8">
        <div className="space-y-8">
          {/* Slider Section */}
          <div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Hours Lost
                </h3>
              </div>
              <div className="text-3xl font-bold text-foreground tabular-nums">
                {hours}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  hrs
                </span>
              </div>
            </div>

            {/* Custom Slider */}
            <div className="relative pt-2 pb-2">
              <input
                type="range"
                min="1"
                max={maxHours}
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <style>{`
                input[type=range]::-webkit-slider-thumb {
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: hsl(var(--foreground));
                  cursor: pointer;
                  border: 2px solid hsl(var(--background));
                  box-shadow: 0 0 0 1px hsl(var(--border));
                }
              `}</style>
              <div className="flex justify-between text-xs text-muted-foreground mt-4 font-medium">
                <span>1h</span>
                <span>{Math.ceil(maxHours / 2)}h</span>
                <span>{maxHours}h</span>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border" />

          {/* Reason Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" />
              Additional Details
            </h3>
            <Textarea
              placeholder="Brief description of the disruption..."
              className="bg-background border-border focus:border-primary text-foreground min-h-25 resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Payout Calculation */}
          <div className="bg-secondary rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Estimated Payout
              </p>
              <p className="text-sm text-muted-foreground">
                {hours} hrs × ₹{payoutPerHour}/hr
              </p>
            </div>
            <div className="text-4xl font-bold text-foreground tabular-nums flex items-center gap-1">
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
          </div>

          <Button
            className="w-full h-11 sm:h-12 text-sm sm:text-base font-medium px-3 sm:px-4"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                <span>Submit Claim</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
