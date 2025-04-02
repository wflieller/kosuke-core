import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

import { db } from '@/lib/db/drizzle';
import { subscriptions, subscriptionProducts } from '@/lib/db/schema';
import { cancelSubscription, SUBSCRIPTION_TIERS } from '@/lib/stripe';
import { getUser } from '@/lib/db/queries';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect('/sign-in');
    }

    // Get the subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id));

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    try {
      // Cancel in Stripe
      await cancelSubscription(subscription.stripeSubscriptionId);
    } catch (err: unknown) {
      // Check if this is a Stripe error
      if (err instanceof Stripe.errors.StripeError) {
        // If the subscription doesn't exist in Stripe, just continue with updating our database
        if (err.code === 'resource_missing') {
          console.log(
            `Subscription ${subscription.stripeSubscriptionId} not found in Stripe, proceeding with local cancellation`
          );
        } else {
          // For other Stripe errors, throw the error to be caught by the outer try/catch
          throw err;
        }
      } else {
        // For non-Stripe errors, rethrow
        throw err;
      }
    }

    // Update in our database
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // Get the free product
    const [freeProduct] = await db
      .select()
      .from(subscriptionProducts)
      .where(eq(subscriptionProducts.tier, SUBSCRIPTION_TIERS.FREE));

    if (!freeProduct) {
      return NextResponse.json({ error: 'Free plan not found' }, { status: 404 });
    }

    // Create a new free subscription
    await db.insert(subscriptions).values({
      userId: user.id,
      productId: freeProduct.id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/billing?canceled=true`);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
