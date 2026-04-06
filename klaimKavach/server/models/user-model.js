import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const locationHistorySchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    vehicle: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "gigworker"],
      default: "gigworker",
      required: true,
    },
    location: {
      type: locationSchema,
      required: false,
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      required: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    locationHistory: {
      type: [locationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
