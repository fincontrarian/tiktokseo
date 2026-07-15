import Stripe from "stripe";

/**
 * Stripe client singleton. STRIPE_API_BASE points the SDK at stripe-mock in
 * dev/tests (http://localhost:12111); unset in production it talks to Stripe.
 */

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  const base = process.env.STRIPE_API_BASE;
  if (!base) return new Stripe(key);

  const url = new URL(base);
  return new Stripe(key, {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    protocol: url.protocol === "https:" ? "https" : "http",
  });
}

export function stripeClient(): Stripe {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = createClient();
  }
  return globalForStripe.stripe;
}
