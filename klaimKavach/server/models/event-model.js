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

const eventDataSchema = new mongoose.Schema(
  {
    rainIntensity: {
      type: Number,
    },
    aqiLevel: {
      type: Number,
    },
    trafficCongestion: {
      type: Number,
    },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["rain", "aqi", "traffic", "composite"],
      required: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    data: {
      type: eventDataSchema,
      default: {},
    },
    riskScore: {
      type: Number,
      default: 0,
    },
    affectedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);

export default Event;
