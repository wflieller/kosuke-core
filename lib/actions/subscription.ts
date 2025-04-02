'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { subscriptions, subscriptionProducts, users } from '@/lib/db/schema';
import { createCheckoutSession, createStripeCustomer, SUBSCRIPTION_TIERS } from '@/lib/stripe';
import { getUser } from '@/lib/db/queries';

/**
 * Get the current user's subscription
 */
export async function getUserSubscription() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  // Get the active subscription for the user
  const [subscription] = await db
    .select({
      subscription: subscriptions,
      product: subscriptionProducts,
    })
    .from(subscriptions)
    .leftJoin(subscriptionProducts, eq(subscriptions.productId, subscriptionProducts.id))
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')));

  return subscription;
}

/**
 * Get all subscription products
 */
export async function getSubscriptionProducts() {
  return await db.select().from(subscriptionProducts).orderBy(subscriptionProducts.price);
}

/**
 * Check if a user can upgrade their subscription
 */
export async function canUpgradeSubscription() {
  const subscription = await getUserSubscription();

  if (!subscription || !subscription.product) {
    return true;
  }

  return subscription.product.tier === SUBSCRIPTION_TIERS.FREE;
}

/**
 * Upgrade subscription using Stripe Checkout
 */
export async function createSubscriptionCheckout(priceId: string) {
  const user = await getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Make sure the user has a Stripe customer ID
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await createStripeCustomer(user.email, user.name || undefined);
    stripeCustomerId = customer.id;

    // Update the user with their Stripe customer ID
    await db.update(users).set({ stripeCustomerId }).where(eq(users.id, user.id));
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const successUrl = `${origin}/billing?success=true`;
  const cancelUrl = `${origin}/billing?canceled=true`;

  const checkoutSession = await createCheckoutSession(
    stripeCustomerId,
    priceId,
    successUrl,
    cancelUrl
  );

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session');
  }

  redirect(checkoutSession.url);
}

/**
 * Handle Stripe webhook events for subscription updates
 */
export async function handleSubscriptionUpdated(
  subscriptionId: string,
  customerId: string,
  status: string,
  priceId: string,
  productId: string
) {
  // Get the user by Stripe customer ID
  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    console.error(`No user found with Stripe customer ID: ${customerId}`);
    return false;
  }

  // Get the product from our database
  const [product] = await db
    .select()
    .from(subscriptionProducts)
    .where(eq(subscriptionProducts.stripeProductId, productId));

  if (!product) {
    console.error(`No product found with Stripe product ID: ${productId}`);
    return false;
  }

  // Check if a subscription already exists
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id));

  const now = new Date();
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  if (existingSubscription) {
    // Update the existing subscription
    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        productId: product.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthLater,
        canceledAt: status === 'canceled' ? now : null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existingSubscription.id));
  } else {
    // Create a new subscription
    await db.insert(subscriptions).values({
      userId: user.id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      productId: product.id,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: oneMonthLater,
      canceledAt: status === 'canceled' ? now : null,
    });
  }

  revalidatePath('/billing');
  return true;
}
