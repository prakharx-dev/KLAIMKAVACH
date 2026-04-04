import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/use-auth";
import { plans, type PlanId } from "@/lib/plans";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const, delay },
});

const faqs = [
  {
    q: "Can I change my plan anytime?",
    a: "Yes. You can upgrade or downgrade your plan at the start of any new weekly cycle with no fees or penalties.",
  },
  {
    q: "How is the weekly premium calculated?",
    a: "Your base rate is fixed per plan, but your AI risk score can reduce it by up to 20% as you build a safe track record.",
  },
  {
    q: "When does coverage start?",
    a: "Coverage is active the moment you complete registration. There's no waiting period.",
  },
  {
    q: "How are claims paid out?",
    a: "Payouts go directly to your registered bank account or UPI ID. No middlemen, no delays beyond the plan's stated payout time.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — your first week on any plan is completely free. Cancel anytime before the trial ends with no charge.",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, selectPlan, login, user } = useAuth();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState<PlanId | null>(null);

  const backendBaseUrl =
    import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ??
    "http://localhost:5000";
  const paymentApiBase = `${backendBaseUrl}/api/payment`;
  const localFallbackApiBase = "http://127.0.0.1:5000/api/payment";
  const razorpayKeyFromEnv = import.meta.env.VITE_RAZORPAY_KEY_ID;

  const fetchPaymentApi = async (path: string, init?: RequestInit) => {
    try {
      return await fetch(`${paymentApiBase}${path}`, init);
    } catch (error) {
      if (backendBaseUrl.includes("localhost")) {
        return fetch(`${localFallbackApiBase}${path}`, init);
      }
      throw error;
    }
  };

  const getPaymentFailureMessage = (
    response?: RazorpayPaymentFailureResponse,
  ) => {
    const description = response?.error?.description?.trim();
    const reason = response?.error?.reason?.trim();

    if (description) {
      if (/international cards are not supported/i.test(description)) {
        return {
          title: "Payment could not be completed",
          description:
            "International cards are not supported for this payment. Please use UPI, net banking, or an India-issued card.",
        };
      }

      return {
        title: "Payment failed",
        description,
      };
    }

    if (reason) {
      return {
        title: "Payment failed",
        description: reason,
      };
    }

    return {
      title: "Payment failed",
      description: "Your transaction did not complete. Please try again.",
    };
  };

  const handlePayment = async (
    planId: PlanId,
    planName: string,
    amount: number,
  ) => {
    let razorpayKey = razorpayKeyFromEnv;
    let configFetchFailed = false;
    let configFetchStatus: number | null = null;

    if (!razorpayKey) {
      try {
        const configResponse = await fetchPaymentApi("/config");
        configFetchStatus = configResponse.status;
        const configPayload = await configResponse.json();
        if (configResponse.ok && configPayload?.keyId) {
          razorpayKey = configPayload.keyId;
        }
      } catch {
        configFetchFailed = true;
      }
    }

    if (!razorpayKey) {
      if (configFetchFailed) {
        toast({
          title: "Payment server unreachable",
          description:
            "Could not fetch payment config from backend. Set VITE_BACKEND_URL to your live backend URL or configure VITE_RAZORPAY_KEY_ID in frontend env.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment configuration missing",
          description:
            configFetchStatus === 404
              ? "Backend payment config endpoint was not found. Deploy backend payment routes or set VITE_RAZORPAY_KEY_ID in frontend env."
              : "Set RAZORPAY_KEY_ID in backend env or VITE_RAZORPAY_KEY_ID in frontend env.",
          variant: "destructive",
        });
      }
      return;
    }

    if (!window.Razorpay) {
      toast({
        title: "Razorpay unavailable",
        description:
          "Checkout SDK did not load. Refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsPaying(planId);

    try {
      const orderResponse = await fetchPaymentApi("/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const orderPayload = await orderResponse.json();

      if (!orderResponse.ok || !orderPayload?.order_id) {
        throw new Error(
          orderPayload?.message || "Unable to create payment order.",
        );
      }

      const options = {
        key: razorpayKey,
        amount: orderPayload.amount,
        currency: orderPayload.currency,
        order_id: orderPayload.order_id,
        name: "KlaimKavach",
        description: `${planName} Plan`,
        retry: {
          enabled: false,
        },
        modal: {
          ondismiss: () => {
            setIsPaying(null);
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyResponse = await fetch(
              `${paymentApiBase}/verify-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              },
            );

            // Retry via 127.0.0.1 when localhost resolution fails in some environments.
            const finalVerifyResponse = verifyResponse.ok
              ? verifyResponse
              : await fetchPaymentApi("/verify-payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(response),
                });

            const verifyPayload = await finalVerifyResponse.json();

            if (!finalVerifyResponse.ok || !verifyPayload?.success) {
              throw new Error("Payment verification failed.");
            }

            selectPlan(planId);
            if (!isAuthenticated) {
              login(user ?? "Gig Worker", "gigworker", planId);
            }

            toast({
              title: "Payment successful",
              description: `${planName} plan is now active.`,
            });
            setLocation("/dashboard");
          } catch {
            toast({
              title: "Verification failed",
              description:
                "Payment was captured but verification failed. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setIsPaying(null);
          }
        },
        prefill: {
          name: user ?? "Gig Worker",
        },
        theme: {
          color: "#111111",
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        const failureMessage = getPaymentFailureMessage(response);
        toast({
          title: failureMessage.title,
          description: failureMessage.description,
          variant: "destructive",
        });
        setIsPaying(null);
      });

      razorpay.open();
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError && /fetch/i.test(error.message);
      toast({
        title: "Payment could not start",
        description: isNetworkError
          ? `Cannot reach payment server at ${backendBaseUrl}. Start backend with npm run server.`
          : error instanceof Error
            ? error.message
            : "Unexpected error while starting checkout.",
        variant: "destructive",
      });
      setIsPaying(null);
    }
  };

  const handleSelectPlan = (planId: "basic" | "pro" | "elite") => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    void handlePayment(plan.id, plan.name, plan.weeklyPremium);
  };

  return (
    <div className="bg-background text-foreground">
      <Helmet>
        <title>Pricing | KlaimKavach</title>
        <meta
          name="description"
          content="Simple, honest weekly pricing for gig worker insurance."
        />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <motion.p
            {...fadeUp(0)}
            className="text-xs uppercase tracking-widest text-white/30 font-medium mb-4"
          >
            Pricing
          </motion.p>
          <motion.h1
            {...fadeUp(0.06)}
            className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.05] mb-5"
          >
            Simple, honest
            <br />
            <span className="text-white/30">weekly pricing.</span>
          </motion.h1>
          <motion.p
            {...fadeUp(0.12)}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            No annual lock-ins. No hidden fees. Pay week to week and cancel
            anytime. Your first week is always free.
          </motion.p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.07)}
              className={`relative flex flex-col p-7 rounded-2xl border transition-all ${
                plan.highlight
                  ? "border-white/20 bg-white/4"
                  : "border-[#1f1f1f] bg-[#111] hover:border-[#2a2a2a]"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest">
                    <Zap className="w-2.5 h-2.5" /> {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-white/30 font-medium mb-3">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold tabular-nums text-foreground">
                    ₹{plan.weeklyPremium}
                  </span>
                  <span className="text-sm text-muted-foreground pb-1">
                    {plan.period}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {plan.desc}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 font-medium">
                    Coverage {plan.coverage}
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-white/60">{f}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isPaying !== null}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all inline-flex cursor-pointer items-center justify-center ${
                  plan.highlight
                    ? "bg-white text-black hover:bg-white/90"
                    : "border border-[#2a2a2a] text-white/60 hover:text-white hover:border-white/20"
                } ${isPaying !== null ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isPaying === plan.id
                  ? "Processing..."
                  : `Switch to ${plan.name}`}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Compare note */}
      <section className="py-6 px-6 border-t border-[#1f1f1f]">
        <motion.p
          {...fadeUp()}
          className="text-center text-xs text-white/20 max-w-md mx-auto"
        >
          All plans include a 7-day free trial. No credit card required to
          start. Billed weekly via UPI, debit card, or net banking.
        </motion.p>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div {...fadeUp()} className="mb-12 text-center">
            <p className="text-xs uppercase tracking-widest text-white/30 font-medium mb-3">
              FAQ
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Common questions.
            </h2>
          </motion.div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                {...fadeUp(i * 0.05)}
                className="p-6 rounded-xl border border-[#1f1f1f] bg-[#111]"
              >
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  {faq.q}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <motion.div
          {...fadeUp()}
          className="max-w-5xl mx-auto text-center p-12 rounded-2xl border border-[#222] bg-[#111]"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            Start your free week today.
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Join 50,000+ gig workers already covered by KlaimKavach.
          </p>
          <Link href={isAuthenticated ? "/dashboard" : "/register"}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex cursor-pointer items-center justify-center gap-2 px-8 py-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              {isAuthenticated ? "Open Dashboard" : "Get Started Free"}{" "}
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
