import { Router } from "express";
import {
  getPaymentConfig,
  createOrder,
  verifyPayment,
} from "../controllers/payment-controller.js";

const paymentRouter = Router();

paymentRouter.get("/config", getPaymentConfig);
paymentRouter.post("/create-order", createOrder);
paymentRouter.post("/verify-payment", verifyPayment);

export default paymentRouter;
