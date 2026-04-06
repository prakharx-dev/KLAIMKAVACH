import mongoose from "mongoose";

const fraudLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "location_jump",
        "excessive_claims",
        "duplicate_device",
        "duplicate_ip",
        "group_fraud",
      ],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    trustScoreBefore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    trustScoreAfter: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const FraudLog =
  mongoose.models.FraudLog || mongoose.model("FraudLog", fraudLogSchema);

export default FraudLog;
