import { api } from "./api.js";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay() {
    return new Promise ((resolve) =>{
        if (window.Razorpay) return resolve(true);
        const s = document.createElement("script");
        s.src = CHECKOUT_SRC;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
} 

export async function startCheckout(user, address){
    if (!(await loadRazorpay())){
        throw new Error("could not load razorpay, check your connection and try again");
    }
    const order = await api.createOrder(address);

    return new Promise((resolve, reject) => {
        let paymentStarted = false;
        let lastFailure = "";


    const rzp = new window.Razorpay({
      key: order.key_id,
      order_id: order.razorpay_order_id,
      amount: order.amount,
      currency: order.currency,
      name: "ShopSphere",
      description: "Test mode payment - no real money",
      prefill: { name: user?.name, email: user?.email },
      theme: { color: "#111827" },
      handler: async (response) => {
        paymentStarted = true;
        try {
          resolve(await api.verifyPayment(response));
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => {
          if (!paymentStarted) reject(new Error(lastFailure || "Payment cancelled"));
        },
      },
    });

    rzp.on("payment.failed", (r) => {
      lastFailure = r?.error?.description || "Payment failed";
    });
    rzp.open();
  });
}