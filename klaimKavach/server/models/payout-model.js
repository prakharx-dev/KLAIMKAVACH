import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    requestedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    eligibleAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    approvedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    hoursLost: {
      type: Number,
      min: 0,
      default: 0,
    },
    planId: {
      type: String,
      enum: ["basic", "pro", "elite"],
      default: "basic",
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "blocked", "paid"],
      default: "pending",
      required: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const Payout = mongoose.models.Payout || mongoose.model("Payout", payoutSchema);

export default Payout;
