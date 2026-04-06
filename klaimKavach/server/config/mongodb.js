import mongoose from "mongoose";

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  await mongoose.connect(mongoUri, {
    autoIndex: true,
  });

  console.log("Connected to MongoDB Atlas");
}
