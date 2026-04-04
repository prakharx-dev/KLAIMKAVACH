declare global {
  interface RazorpayPaymentSuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayPaymentFailureResponse {
    error?: {
      code?: string;
      description?: string;
      reason?: string;
      source?: string;
      step?: string;
      metadata?: {
        order_id?: string;
        payment_id?: string;
      };
    };
  }

  interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    handler: (response: RazorpayPaymentSuccessResponse) => void | Promise<void>;
    retry?: {
      enabled?: boolean;
      max_count?: number;
    };
    modal?: {
      ondismiss?: () => void;
      escape?: boolean;
      backdropclose?: boolean;
      confirm_close?: boolean;
    };
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    theme?: {
      color?: string;
    };
  }

  interface RazorpayInstance {
    open: () => void;
    on: (
      event: string,
      callback: (response: RazorpayPaymentFailureResponse) => void,
    ) => void;
  }

  interface RazorpayStatic {
    new (options: RazorpayOptions): RazorpayInstance;
  }

  interface Window {
    Razorpay?: RazorpayStatic;
  }
}

export {};
