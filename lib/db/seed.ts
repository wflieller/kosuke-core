import { hashPassword } from '@/lib/auth/session';
import {
  SUBSCRIPTION_TIERS,
  TIER_FEATURES,
  TIER_PRICING,
  PRODUCT_METADATA,
  createOrRetrieveProducts,
  createStripeCustomer,
} from '@/lib/stripe';
import { eq } from 'drizzle-orm';

import { db } from './drizzle';
import { users, subscriptionProducts, subscriptions } from './schema';

async function seed() {
  // Clear existing data
  console.log('Clearing existing subscription data...');
  try {
    // Delete subscriptions first (foreign key constraints)
    await db.delete(subscriptions);
    console.log('Existing subscriptions deleted.');

    // Delete subscription products
    await db.delete(subscriptionProducts);
    console.log('Existing subscription products deleted.');
  } catch (error) {
    console.error('Error clearing existing data:', error);
  }

  // Create Stripe products and prices
  console.log('Setting up Stripe products...');
  const stripeProducts = await createOrRetrieveProducts();

  // Save products to database
  console.log('Saving subscription products to database...');
  for (const tier of Object.values(SUBSCRIPTION_TIERS)) {
    const stripeProduct = stripeProducts[tier];
    const metadata = PRODUCT_METADATA[tier as keyof typeof PRODUCT_METADATA];
    const price = TIER_PRICING[tier as keyof typeof TIER_PRICING];

    // Get the default price ID from the Stripe product
    const defaultPriceId = stripeProduct.default_price || '';

    console.log(`Product: ${metadata.name}, Price: ${price}, Default Price ID: ${defaultPriceId}`);

    await db
      .insert(subscriptionProducts)
      .values({
        stripeProductId: stripeProduct.id,
        stripePriceId: defaultPriceId as string,
        name: metadata.name,
        description: metadata.description,
        tier,
        price: price ?? undefined,
        features: TIER_FEATURES[tier as keyof typeof TIER_FEATURES],
      })
      .onConflictDoUpdate({
        target: subscriptionProducts.stripeProductId,
        set: {
          stripePriceId: defaultPriceId as string,
          name: metadata.name,
          description: metadata.description,
          price: price ?? undefined,
          features: TIER_FEATURES[tier as keyof typeof TIER_FEATURES],
          updatedAt: new Date(),
        },
      });
  }

  console.log('Subscription products created.');

  // Handle user creation or retrieval
  const email = 'admin@example.com';
  const password = 'admin12345';
  const passwordHash = await hashPassword(password);

  // Check if the user already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email));

  let user = existingUsers[0];

  if (!user) {
    // User doesn't exist, create a new one
    console.log('Creating new user...');

    // Create a Stripe customer for the user
    const stripeCustomer = await createStripeCustomer(email);

    const [newUser] = await db
      .insert(users)
      .values([
        {
          email: email,
          passwordHash: passwordHash,
          role: 'owner',
          stripeCustomerId: stripeCustomer.id,
        },
      ])
      .returning();

    user = newUser;
    console.log('Initial user created.');
  } else {
    console.log('User already exists, using existing user.');

    // Update Stripe customer ID if missing
    if (!user.stripeCustomerId) {
      const stripeCustomer = await createStripeCustomer(email);
      await db
        .update(users)
        .set({
          stripeCustomerId: stripeCustomer.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      console.log('Updated user with Stripe customer ID.');
    }
  }

  // Get the free product
  const [freeProduct] = await db
    .select()
    .from(subscriptionProducts)
    .where(eq(subscriptionProducts.tier, SUBSCRIPTION_TIERS.FREE));

  // Create free subscription for the user
  await db.insert(subscriptions).values({
    userId: user.id,
    productId: freeProduct.id,
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year in the future
  });

  console.log('Free subscription created for user.');
}

seed()
  .catch(error => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
