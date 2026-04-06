import { Router } from "express";
import {
  createClaim,
  getDashboard,
  getDisruption,
  registerUser,
  saveUserPlan,
  signInUser,
  scoreFraud,
} from "../controllers/core-controller.js";

const coreRouter = Router();

coreRouter.post("/register", registerUser);
coreRouter.post("/signin", signInUser);
coreRouter.post("/plan/select", saveUserPlan);
coreRouter.post("/fraud", scoreFraud);
coreRouter.post("/claim", createClaim);
coreRouter.get("/dashboard", getDashboard);
coreRouter.get("/disruption", getDisruption);

export default coreRouter;
