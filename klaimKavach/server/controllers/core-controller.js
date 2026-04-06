import Event from "../models/event-model.js";
import FraudLog from "../models/fraud-log-model.js";
import Payout from "../models/payout-model.js";
import Subscription from "../models/subscription-model.js";
import User from "../models/user-model.js";
import {
  calculateTrustScore,
  clamp,
  isValidCoordinate,
} from "../utils/risk-utils.js";

function resolveClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (typeof req.ip === "string") {
    return req.ip;
  }
  return "";
}

function normalizePlanId(plan) {
  if (plan === "pro" || plan === "premium") return "pro";
  if (plan === "elite" || plan === "enterprise") return "elite";
  return "basic";
}

const PLAN_RULES = {
  basic: {
    payoutPerHour: 120,
    claimHoursCap: 8,
    dailyCap: 1200,
    weeklyCap: 2400,
  },
  pro: {
    payoutPerHour: 170,
    claimHoursCap: 10,
    dailyCap: 2200,
    weeklyCap: 4200,
  },
  elite: {
    payoutPerHour: 230,
    claimHoursCap: 12,
    dailyCap: 3200,
    weeklyCap: 6500,
  },
};

function getPlanRules(plan) {
  return PLAN_RULES[normalizePlanId(plan)] ?? PLAN_RULES.basic;
}

function getWeeklyPremiumForPlan(plan) {
  const normalizedPlan = normalizePlanId(plan);
  if (normalizedPlan === "pro") return 69;
  if (normalizedPlan === "elite") return 99;
  return 49;
}

function getCoverageForPlan(plan) {
  const normalizedPlan = normalizePlanId(plan);
  if (normalizedPlan === "pro") return 50000;
  if (normalizedPlan === "elite") return 100000;
  return 25000;
}

function getRiskLevel(score) {
  if (score > 70) return "Low Risk";
  if (score >= 30) return "Medium Risk";
  return "High Risk";
}

function toObjectIdString(value) {
  return value ? String(value) : "";
}

async function getLatestActivePlanByUserId(userId) {
  if (!userId) return null;

  const activePlan = await Subscription.findOne({
    userId,
    status: "active",
  }).sort({ createdAt: -1 });

  return activePlan ? normalizePlanId(activePlan.plan) : null;
}

function resolveRole(value, fallback = "gigworker") {
  return value === "admin" || value === "gigworker" ? value : fallback;
}

export async function saveUserPlan(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const planId = ["basic", "pro", "elite", "premium", "enterprise"].includes(
      body.planId,
    )
      ? normalizePlanId(body.planId)
      : null;

    if (!email || !planId) {
      res.status(400).json({
        success: false,
        message: "email and a valid planId are required.",
      });
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await Subscription.findOneAndUpdate(
      { userId: user._id, status: "active" },
      {
        $set: {
          userId: user._id,
          plan: planId,
          status: "active",
          startDate: new Date(),
          endDate,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      },
    );

    user.subscriptionStatus = "active";
    await user.save();

    res.status(200).json({
      success: true,
      message: "Plan saved successfully",
      userId: toObjectIdString(user._id),
      planId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save purchased plan.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function signInUser(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      res.status(400).json({
        success: false,
        message: "email is required.",
      });
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    const activePlanId = await getLatestActivePlanByUserId(user._id);

    res.setHeader(
      "Set-Cookie",
      `klaimName=${encodeURIComponent(user.name)}; Path=/; Max-Age=86400`,
    );

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      userId: toObjectIdString(user._id),
      userName: user.name,
      role: resolveRole(user.role),
      planId: activePlanId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to sign in user.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function registerUser(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const vehicle = typeof body.vehicle === "string" ? body.vehicle.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const requestedRole = resolveRole(body.role);
    const requestedPlan = [
      "basic",
      "pro",
      "elite",
      "premium",
      "enterprise",
    ].includes(body.plan)
      ? normalizePlanId(body.plan)
      : null;
    const latitude = typeof body.latitude === "number" ? body.latitude : null;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : null;
    const deviceId =
      typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const ipAddress =
      typeof body.ipAddress === "string" && body.ipAddress.trim()
        ? body.ipAddress.trim()
        : resolveClientIp(req);

    if (!name || !email) {
      res.status(400).json({
        success: false,
        message: "name and email are required.",
      });
      return;
    }

    const hasValidLocation =
      isValidCoordinate(latitude, -90, 90) &&
      isValidCoordinate(longitude, -180, 180);

    const trustResult = calculateTrustScore({
      latitude: hasValidLocation ? latitude : undefined,
      longitude: hasValidLocation ? longitude : undefined,
      ipAddress,
    });

    const existingUser = await User.findOne({ email });
    const role = existingUser?.role
      ? resolveRole(existingUser.role)
      : requestedRole;

    const setPayload = {
      name,
      email,
      phone,
      vehicle,
      city,
      ip: ipAddress,
      deviceId,
      role,
      trustScore: trustResult.trustScore,
      subscriptionStatus: "active",
    };

    if (hasValidLocation) {
      setPayload.location = { lat: latitude, lng: longitude };
    }

    const updatePayload = {
      $set: setPayload,
    };

    if (hasValidLocation) {
      updatePayload.$push = {
        locationHistory: {
          lat: latitude,
          lng: longitude,
          timestamp: new Date(),
        },
      };
    }

    const user = await User.findOneAndUpdate({ email }, updatePayload, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    });

    if (requestedPlan) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      await Subscription.findOneAndUpdate(
        { userId: user._id, status: "active" },
        {
          $set: {
            userId: user._id,
            plan: requestedPlan,
            status: "active",
            startDate: new Date(),
            endDate,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        },
      );
    }

    const activePlanId = await getLatestActivePlanByUserId(user._id);

    res.setHeader(
      "Set-Cookie",
      `klaimName=${encodeURIComponent(name)}; Path=/; Max-Age=86400`,
    );

    res.status(200).json({
      success: true,
      userId: toObjectIdString(user._id),
      message: "Registered successfully",
      trustScore: trustResult.trustScore,
      userName: user.name,
      role,
      planId: activePlanId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to register user.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function scoreFraud(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const latitude =
      typeof body.latitude === "number" ? body.latitude : undefined;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : undefined;
    const ipAddress =
      typeof body.ipAddress === "string" && body.ipAddress.trim()
        ? body.ipAddress.trim()
        : resolveClientIp(req);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    const result = calculateTrustScore({ latitude, longitude, ipAddress });

    const user = userId
      ? await User.findById(userId)
      : email
        ? await User.findOne({ email })
        : null;

    if (user) {
      const trustScoreBefore = user.trustScore ?? 100;

      user.trustScore = result.trustScore;
      if (ipAddress) {
        user.ip = ipAddress;
      }
      if (
        isValidCoordinate(latitude, -90, 90) &&
        isValidCoordinate(longitude, -180, 180)
      ) {
        user.location = { lat: latitude, lng: longitude };
        user.locationHistory.push({
          lat: latitude,
          lng: longitude,
          timestamp: new Date(),
        });
      }

      await user.save();

      const trustDrop = trustScoreBefore - result.trustScore;
      if (trustDrop >= 20 || result.trustScore < 45) {
        await FraudLog.create({
          userId: user._id,
          type: trustDrop >= 20 ? "location_jump" : "duplicate_ip",
          details: {
            previousScore: trustScoreBefore,
            currentScore: result.trustScore,
            latitude,
            longitude,
            ipAddress,
          },
          trustScoreBefore,
          trustScoreAfter: result.trustScore,
          severity:
            result.trustScore < 25
              ? "critical"
              : result.trustScore < 45
                ? "high"
                : "medium",
          resolved: false,
        });
      }
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to calculate trust score.",
    });
  }
}

export async function createClaim(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const requestedAmount = Number(body.amount ?? 0);
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Disruption-related claim";
    const requestedHours = clamp(
      Math.round(Number(body.hoursLost ?? 1)),
      1,
      24,
    );

    if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
      res.status(400).json({
        success: false,
        message: "amount must be a valid non-negative number.",
      });
      return;
    }

    const user = userId
      ? await User.findById(userId)
      : email
        ? await User.findOne({ email })
        : null;

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found. Provide valid userId or email.",
      });
      return;
    }

    const activeSubscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    const planId = normalizePlanId(activeSubscription?.plan ?? "basic");
    const planRules = getPlanRules(planId);
    const billableHours = clamp(requestedHours, 1, planRules.claimHoursCap);

    const duplicateWindowStart = new Date(Date.now() - 10 * 60 * 1000);
    const recentDuplicate = await Payout.findOne({
      userId: user._id,
      reason,
      createdAt: { $gte: duplicateWindowStart },
      status: { $in: ["approved", "pending", "paid"] },
    });

    if (recentDuplicate) {
      res.status(409).json({
        success: false,
        message:
          "Duplicate claim detected in the last 10 minutes. Please wait before filing again.",
      });
      return;
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [dailyPaid, weeklyPaid] = await Promise.all([
      Payout.aggregate([
        {
          $match: {
            userId: user._id,
            createdAt: { $gte: dayStart },
            status: { $in: ["approved", "paid"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payout.aggregate([
        {
          $match: {
            userId: user._id,
            createdAt: { $gte: weekStart },
            status: { $in: ["approved", "paid"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const dailyTotal = Number(dailyPaid?.[0]?.total ?? 0);
    const weeklyTotal = Number(weeklyPaid?.[0]?.total ?? 0);

    const latitude =
      typeof body.latitude === "number"
        ? body.latitude
        : (user.location?.lat ?? 0);
    const longitude =
      typeof body.longitude === "number"
        ? body.longitude
        : (user.location?.lng ?? 0);
    const eventType = ["rain", "aqi", "traffic", "composite"].includes(
      body.eventType,
    )
      ? body.eventType
      : "composite";

    const eventRiskScore = clamp(
      Number(body.eventRiskScore ?? 100 - user.trustScore),
      0,
      100,
    );

    const event = await Event.create({
      type: eventType,
      location: {
        lat: latitude,
        lng: longitude,
      },
      data: {
        rainIntensity: Number(body.rainIntensity ?? 0),
        aqiLevel: Number(body.aqiLevel ?? 0),
        trafficCongestion: Number(body.trafficCongestion ?? 0),
      },
      riskScore: eventRiskScore,
      affectedUsers: [user._id],
      resolved: false,
    });

    const claimRiskScore = clamp(
      Math.round((eventRiskScore + (100 - (user.trustScore ?? 100))) / 2),
      0,
      100,
    );

    const eligibleAmount = Math.round(billableHours * planRules.payoutPerHour);

    const dailyRemaining = Math.max(0, planRules.dailyCap - dailyTotal);
    const weeklyRemaining = Math.max(0, planRules.weeklyCap - weeklyTotal);
    const cappedEligibleAmount = Math.max(
      0,
      Math.min(eligibleAmount, dailyRemaining, weeklyRemaining),
    );

    const amount = cappedEligibleAmount;

    const status =
      amount <= 0
        ? "blocked"
        : user.trustScore >= 75 && claimRiskScore < 45
          ? "approved"
          : user.trustScore >= 50 && claimRiskScore < 70
            ? "pending"
            : "blocked";
    const flagged = status === "blocked" || claimRiskScore >= 70;
    const flagReason =
      amount <= 0
        ? "Plan payout limits reached for this period."
        : status === "blocked"
          ? "Low trust score detected; manual review required."
          : flagged
            ? "Claim risk score is elevated."
            : "";

    const payout = await Payout.create({
      userId: user._id,
      eventId: event._id,
      amount: Math.round(amount),
      requestedAmount: Math.round(Math.max(0, requestedAmount)),
      eligibleAmount: Math.round(eligibleAmount),
      approvedAmount: status === "approved" ? Math.round(amount) : 0,
      hoursLost: billableHours,
      planId,
      reason,
      status,
      riskScore: claimRiskScore,
      flagged,
      flagReason,
    });

    if (status === "blocked") {
      await FraudLog.create({
        userId: user._id,
        type: "excessive_claims",
        details: {
          payoutId: payout._id,
          claimRiskScore,
          trustScore: user.trustScore,
        },
        trustScoreBefore: user.trustScore,
        trustScoreAfter: clamp(user.trustScore - 5, 0, 100),
        severity: claimRiskScore > 80 ? "critical" : "high",
        resolved: false,
      });

      user.trustScore = clamp(user.trustScore - 5, 0, 100);
      await user.save();
    }

    res.status(200).json({
      success: true,
      claimId: toObjectIdString(payout._id),
      payoutAmount: payout.status === "approved" ? payout.amount : 0,
      eligibleAmount: payout.eligibleAmount,
      requestedAmount: payout.requestedAmount,
      hoursConsidered: payout.hoursLost,
      planId: payout.planId,
      status: payout.status.charAt(0).toUpperCase() + payout.status.slice(1),
      message:
        payout.status === "approved"
          ? "Claim approved instantly by AI."
          : payout.status === "pending"
            ? "Claim is pending additional review."
            : "Claim blocked for fraud review.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create claim.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getDashboard(req, res) {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";

    const user = userId
      ? await User.findById(userId)
      : email
        ? await User.findOne({ email })
        : null;

    const activePolicies = user
      ? await Subscription.countDocuments({
          userId: user._id,
          status: "active",
        })
      : 0;
    const totalClaims = user
      ? await Payout.countDocuments({ userId: user._id })
      : 0;
    const activePlan = user
      ? await Subscription.findOne({ userId: user._id, status: "active" }).sort(
          { createdAt: -1 },
        )
      : null;

    const trustScore = user?.trustScore ?? 50;
    const plan = activePlan?.plan ?? "basic";

    res.status(200).json({
      userName: user?.name ?? "Gig Worker",
      riskScore: trustScore,
      riskLevel: getRiskLevel(trustScore),
      weeklyPremium: getWeeklyPremiumForPlan(plan),
      coverageAmount: getCoverageForPlan(plan),
      activePolicies,
      totalClaims,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to fetch dashboard.",
    });
  }
}

export async function getDisruption(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(200).json({
        hasDisruption: false,
        type: "None",
        severity: "None",
        message: "Clear skies and normal traffic in your zone.",
        eligibleForClaim: false,
      });
      return;
    }

    const latestEvent = await Event.findOne({
      resolved: false,
      "location.lat": { $gte: lat - 0.25, $lte: lat + 0.25 },
      "location.lng": { $gte: lng - 0.25, $lte: lng + 0.25 },
    }).sort({ createdAt: -1 });

    if (!latestEvent) {
      res.status(200).json({
        hasDisruption: false,
        type: "None",
        severity: "None",
        message: "Clear skies and normal traffic in your zone.",
        eligibleForClaim: false,
      });
      return;
    }

    const severity =
      latestEvent.riskScore >= 80
        ? "Severe"
        : latestEvent.riskScore >= 60
          ? "High"
          : latestEvent.riskScore >= 35
            ? "Moderate"
            : "Low";

    res.status(200).json({
      hasDisruption: true,
      type: latestEvent.type,
      severity,
      message: `${latestEvent.type.toUpperCase()} disruption detected near your zone.`,
      eligibleForClaim: latestEvent.riskScore >= 35,
      eventId: toObjectIdString(latestEvent._id),
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch disruption status.",
    });
  }
}
