import Stripe from 'stripe';
import { SUBSCRIPTION_TIERS, TIER_PRICING, TIER_FEATURES } from '@/lib/constants';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

export { SUBSCRIPTION_TIERS, TIER_PRICING, TIER_FEATURES };

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export const PRODUCT_METADATA = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    description: 'Free tier with limited features',
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    name: 'Premium',
    description: 'Enhanced features for professionals',
  },
  [SUBSCRIPTION_TIERS.BUSINESS]: {
    name: 'Business',
    description: 'Advanced features for organizations',
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
  },
};

export async function createStripeCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
  });

  return customer;
}

export async function createOrRetrieveProducts() {
  const products: { [key: string]: Stripe.Product } = {};

  for (const tier of Object.values(SUBSCRIPTION_TIERS)) {
    const existingProducts = await stripe.products.list({
      active: true,
      limit: 100,
    });

    const existingProduct = existingProducts.data.find(p => p.metadata.tier === tier);

    if (existingProduct && existingProduct.active) {
      products[tier] = existingProduct;
      continue;
    }

    const price = TIER_PRICING[tier as keyof typeof TIER_PRICING];
    const metadata = PRODUCT_METADATA[tier as keyof typeof PRODUCT_METADATA];

    const product = await stripe.products.create({
      name: metadata.name,
      description: metadata.description,
      metadata: {
        tier,
        platform: 'Kosuke',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
      },
      default_price_data:
        price !== null
          ? {
              currency: 'usd',
              unit_amount: price * 100, // Convert to cents
              recurring: {
                interval: 'month',
              },
            }
          : undefined,
    });

    products[tier] = product;
  }

  return products;
}

export async function createSubscription(customerId: string, priceId: string) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}
