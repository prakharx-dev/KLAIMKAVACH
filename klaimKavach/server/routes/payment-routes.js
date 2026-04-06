import { Router } from "express";
import {
  getPaymentConfig,
  createOrder,
  verifyPayment,
  reconcilePayment,
} from "../controllers/payment-controller.js";

const paymentRouter = Router();

paymentRouter.get("/config", getPaymentConfig);
paymentRouter.post("/create-order", createOrder);
paymentRouter.post("/verify-payment", verifyPayment);
paymentRouter.post("/reconcile-payment", reconcilePayment);

export default paymentRouter;
