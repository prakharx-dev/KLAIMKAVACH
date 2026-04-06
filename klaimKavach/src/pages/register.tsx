import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Zap,
  Lock,
  Bike,
  ShieldCheck,
} from "lucide-react";
import type { UserRole } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/use-auth";
import { isPlanId, plansById, type PlanId } from "@/lib/plans";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  vehicle: z.string().optional(),
  city: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

type SignInApiResponse = {
  success?: boolean;
  message?: string;
  userName?: string;
  role?: UserRole;
  planId?: string | null;
};

const features = [
  { icon: Zap, text: "Instant claim approvals in under 60 seconds" },
  { icon: Shield, text: "AI-powered risk coverage tailored to your routes" },
  { icon: Lock, text: "Bank-grade security for all your data" },
  { icon: CheckCircle2, text: "Trusted by 50,000+ gig workers across India" },
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, selectedPlan } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>("gigworker");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const backendBaseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

  const apiBaseCandidates = [
    backendBaseUrl,
    typeof window !== "undefined" ? window.location.origin : undefined,
    "http://localhost:5000",
  ].filter(
    (value, index, array): value is string =>
      Boolean(value) && array.indexOf(value) === index,
  );

  const fetchAuthApi = async (path: string, init?: RequestInit) => {
    let lastError: unknown = null;

    for (const baseUrl of apiBaseCandidates) {
      try {
        return await fetch(`${baseUrl}/api${path}`, init);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Unable to reach authentication server.");
  };

  const selectedPlanId = useMemo(() => {
    if (typeof window === "undefined") return selectedPlan;
    const planFromQuery = new URLSearchParams(window.location.search).get(
      "plan",
    );
    if (isPlanId(planFromQuery)) return planFromQuery;
    return selectedPlan;
  }, [selectedPlan]);

  const selectedPlanName = selectedPlanId
    ? plansById[selectedPlanId].name
    : "your chosen";

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    const email = data.email.trim().toLowerCase();

    try {
      const signInResponse = await fetchAuthApi("/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (signInResponse.ok) {
        const payload = (await signInResponse.json()) as SignInApiResponse;
        const roleFromDb =
          payload.role === "admin" || payload.role === "gigworker"
            ? payload.role
            : "gigworker";
        const planFromDb = isPlanId(payload.planId)
          ? payload.planId
          : undefined;

        localStorage.setItem("klaimkavach_email", email);
        login(payload.userName ?? data.name, roleFromDb, planFromDb);

        toast({
          title: "Welcome back",
          description: "Signed in with your existing account.",
        });

        setLocation(roleFromDb === "admin" ? "/admin" : "/dashboard");
        setIsSubmitting(false);
        return;
      }

      if (signInResponse.status !== 404) {
        const errorPayload = (await signInResponse.json()) as SignInApiResponse;
        throw new Error(errorPayload.message || "Sign in failed.");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !/User not found/i.test(error.message) &&
        !/fetch|network|failed to fetch|load failed/i.test(error.message)
      ) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const registerResponse = await fetchAuthApi("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          email,
          role: selectedRole,
          vehicle: data.vehicle ?? "",
          city: data.city ?? "",
        }),
      });

      const response = (await registerResponse.json()) as SignInApiResponse;

      if (!registerResponse.ok || response.success === false) {
        throw new Error(response.message || "Registration failed.");
      }

      const roleFromDb =
        response.role === "admin" || response.role === "gigworker"
          ? response.role
          : selectedRole;
      const planFromDb = isPlanId(response.planId)
        ? response.planId
        : undefined;

      localStorage.setItem("klaimkavach_email", email);
      login(response.userName ?? data.name, roleFromDb, planFromDb);

      toast({
        title:
          roleFromDb === "admin" ? "Welcome, Admin" : "Welcome to KlaimKavach",
        description:
          roleFromDb === "admin"
            ? "You're now logged in as an administrator."
            : planFromDb
              ? `Your ${plansById[planFromDb].name} plan is now active.`
              : "Account created successfully. Choose a plan from Pricing to activate coverage.",
      });
      setLocation(roleFromDb === "admin" ? "/admin" : "/dashboard");
    } catch (error) {
      toast({
        title: "Registration Failed",
        description:
          error instanceof Error &&
          /fetch|network|failed to fetch|load failed/i.test(error.message)
            ? "Could not reach the backend. Set VITE_BACKEND_URL to your deployed backend URL or ensure /api is routed to backend."
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <Helmet>
        <title>Sign Up | KlaimKavach</title>
      </Helmet>
      {/* Left Panel — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0f0f0f] border-r border-[#1f1f1f] relative overflow-hidden"
      >
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="KlaimKavach"
            className="w-9 h-9 rounded-lg object-contain"
          />
          <span className="text-white font-semibold text-lg tracking-tight">
            KlaimKavach
          </span>
        </div>

        {/* Middle — Headline + Features */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-white/30 font-medium">
              AI-Powered Insurance
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-white leading-[1.15]">
              Coverage that works as hard as you do.
            </h2>
            <p className="text-white/40 text-base leading-relaxed max-w-sm">
              Built for delivery riders, cab drivers, and freelancers. Get
              instant claims, smart risk scoring, and real protection.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map((f, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-white/5 border border-white/[0.07] flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-white/60" />
                </div>
                <span className="text-sm text-white/50">{f.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Bottom — Social proof */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/6">
            <div className="flex -space-x-2">
              {["A", "R", "M", "K"].map((initial, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-medium text-white/70"
                >
                  {initial}
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-white/60">
                <span className="text-white font-semibold">2,400+</span> workers
                joined this week
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right Panel — Form */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-background"
      >
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <img
            src="/logo.jpg"
            alt="KlaimKavach"
            className="w-8 h-8 rounded-md object-contain"
          />
          <span className="font-semibold text-foreground">KlaimKavach</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Start your free coverage today. No credit card required.
            </p>
            {selectedPlanId && (
              <p className="mt-2 text-xs text-emerald-400 font-medium uppercase tracking-widest">
                Selected plan: {selectedPlanName}
              </p>
            )}
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2 block">
              I am a
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole("gigworker")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedRole === "gigworker"
                    ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    : "border-[#222] bg-[#111] hover:border-[#333]"
                }`}
              >
                <Bike
                  className={`w-5 h-5 shrink-0 ${selectedRole === "gigworker" ? "text-emerald-400" : "text-muted-foreground"}`}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${selectedRole === "gigworker" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Gig Worker
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Driver / Rider
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedRole === "admin"
                    ? "border-violet-500/60 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                    : "border-[#222] bg-[#111] hover:border-[#333]"
                }`}
              >
                <ShieldCheck
                  className={`w-5 h-5 shrink-0 ${selectedRole === "admin" ? "text-violet-400" : "text-muted-foreground"}`}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${selectedRole === "admin" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Admin
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Manager / Ops
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Full Name
              </Label>
              <Input
                id="name"
                placeholder="Rahul Sharma"
                className="h-11 bg-[#111] border-[#222] text-foreground placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-0 rounded-lg"
                {...formRegister("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="rahul@example.com"
                className="h-11 bg-[#111] border-[#222] text-foreground placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-0 rounded-lg"
                {...formRegister("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Phone
              </Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                className="h-11 bg-[#111] border-[#222] text-foreground placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-0 rounded-lg"
                {...formRegister("phone")}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              {selectedRole === "gigworker" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                  exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="grid grid-cols-2 gap-4 overflow-hidden"
                >
                  <div className="space-y-1.5 pt-1">
                    <Label
                      htmlFor="vehicle"
                      className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                    >
                      Vehicle
                    </Label>
                    <Input
                      id="vehicle"
                      placeholder="2-Wheeler (EV)"
                      className="h-11 bg-[#111] border-[#222] text-foreground placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-0 rounded-lg"
                      {...formRegister("vehicle")}
                    />
                    {errors.vehicle && (
                      <p className="text-xs text-destructive">
                        {errors.vehicle.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label
                      htmlFor="city"
                      className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                    >
                      City
                    </Label>
                    <Input
                      id="city"
                      placeholder="Bengaluru"
                      className="h-11 bg-[#111] border-[#222] text-foreground placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-0 rounded-lg"
                      {...formRegister("city")}
                    />
                    {errors.city && (
                      <p className="text-xs text-destructive">
                        {errors.city.message}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 mt-2 font-medium rounded-lg flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Get Protected
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing up you agree to our{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">
              Privacy Policy
            </span>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}
