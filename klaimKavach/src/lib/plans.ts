export type PlanId = "basic" | "pro" | "elite";

export interface InsurancePlan {
  id: PlanId;
  name: string;
  weeklyPremium: number;
  period: string;
  desc: string;
  coverage: string;
  claimPayoutPerHour: number;
  claimHoursCap: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
}

export const plans: InsurancePlan[] = [
  {
    id: "basic",
    name: "Basic",
    weeklyPremium: 49,
    period: "/week",
    desc: "Light coverage for part-time gig workers.",
    coverage: "Up to 20% of average weekly earnings",
    claimPayoutPerHour: 120,
    claimHoursCap: 8,
    highlight: false,
    features: [
      "Weather disruption cover",
      "AI risk score",
      "Instant claim filing",
      "48hr payout",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    weeklyPremium: 69,
    period: "/week",
    desc: "Full protection for full-time gig workers.",
    coverage: "Up to 35% of average weekly earnings",
    claimPayoutPerHour: 170,
    claimHoursCap: 10,
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Basic",
      "Vehicle breakdown cover",
      "Medical emergency cover",
      "24hr payout",
      "Priority support",
      "Smart disruption alerts",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    weeklyPremium: 99,
    period: "/week",
    desc: "Maximum coverage for top earners.",
    coverage: "Up to 50% of average weekly earnings",
    claimPayoutPerHour: 230,
    claimHoursCap: 12,
    highlight: false,
    features: [
      "Everything in Pro",
      "Income replacement cover",
      "Legal assistance cover",
      "Same-day payout",
      "Dedicated account manager",
      "Family health add-on",
    ],
  },
];

export const plansById: Record<PlanId, InsurancePlan> = {
  basic: plans[0],
  pro: plans[1],
  elite: plans[2],
};

export const isPlanId = (value: string | null): value is PlanId => {
  return value === "basic" || value === "pro" || value === "elite";
};
