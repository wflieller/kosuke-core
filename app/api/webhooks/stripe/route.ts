import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { handleSubscriptionUpdated } from '@/lib/actions/subscription';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;

  if (!signature || !endpointSecret) {
    return NextResponse.json(
      { error: 'Missing stripe signature or endpoint secret' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err: unknown) {
    const error = err instanceof Stripe.errors.StripeError ? err : new Error('Unknown error');
    console.error(`Webhook Error: ${error.message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0].price.id;
        const productId = subscription.items.data[0].price.product as string;

        await handleSubscriptionUpdated(
          subscription.id,
          subscription.customer as string,
          subscription.status,
          priceId,
          productId
        );

        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle subscription checkouts
        if (session.mode === 'subscription' && session.subscription) {
          // Get the subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0].price.id;
          const productId = subscription.items.data[0].price.product as string;

          console.log(
            `Processing checkout.session.completed for customer ${session.customer}, subscription ${session.subscription}`
          );

          await handleSubscriptionUpdated(
            subscription.id,
            session.customer as string,
            subscription.status,
            priceId,
            productId
          );
        }

        break;
      }
      // Add other webhook event handlers as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
  }
}
