import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/subscription/checkout/route';
import { getSession } from '@/lib/auth/session';
import { getUser } from '@/lib/db/queries';
import { createCheckoutSession } from '@/lib/stripe';

// Mock dependencies
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn(),
    redirect: jest.fn(),
  },
}));

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/db/queries', () => ({
  getUser: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
  createCheckoutSession: jest.fn(),
}));

describe('Subscription Checkout API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  test('redirects to sign-in if not authenticated', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('https://example.com/api/subscription/checkout');

    // Act
    const _response = await POST(request);

    // Assert
    expect(NextResponse.redirect).toHaveBeenCalledWith('/sign-in');
    expect(getUser).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test('returns error if price ID is missing', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 1 } });

    const mockSearchParams = new URLSearchParams();
    const request = new NextRequest('https://example.com/api/subscription/checkout');
    (request as any).nextUrl = {
      searchParams: mockSearchParams,
    };

    // Act
    const _response = await POST(request);

    // Assert
    expect(NextResponse.json).toHaveBeenCalledWith({ error: 'Missing price ID' }, { status: 400 });
    expect(getUser).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test('returns error if user is not found or missing Stripe customer ID', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 1 } });
    (getUser as jest.Mock).mockResolvedValue(null);

    const mockSearchParams = new URLSearchParams({ priceId: 'price_123' });
    const request = new NextRequest('https://example.com/api/subscription/checkout');
    (request as any).nextUrl = {
      searchParams: mockSearchParams,
    };

    // Act
    const _response = await POST(request);

    // Assert
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'User not found or missing Stripe customer ID' },
      { status: 400 }
    );
    expect(getUser).toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test('returns error if user does not have a Stripe customer ID', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 1 } });
    (getUser as jest.Mock).mockResolvedValue({ id: 1, email: 'test@example.com' }); // No stripeCustomerId

    const mockSearchParams = new URLSearchParams({ priceId: 'price_123' });
    const request = new NextRequest('https://example.com/api/subscription/checkout');
    (request as any).nextUrl = {
      searchParams: mockSearchParams,
    };

    // Act
    const _response = await POST(request);

    // Assert
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'User not found or missing Stripe customer ID' },
      { status: 400 }
    );
    expect(getUser).toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test('creates checkout session and returns URL', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 1 } });
    (getUser as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      stripeCustomerId: 'cus_123',
    });

    const mockCheckoutSession = {
      url: 'https://checkout.stripe.com/c/cs_123',
    };
    (createCheckoutSession as jest.Mock).mockResolvedValue(mockCheckoutSession);

    const mockSearchParams = new URLSearchParams({ priceId: 'price_123' });
    const request = new NextRequest('https://example.com/api/subscription/checkout');
    (request as any).nextUrl = {
      searchParams: mockSearchParams,
    };

    // Act
    const _response = await POST(request);

    // Assert
    expect(getUser).toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledWith(
      'cus_123',
      'price_123',
      'https://example.com/billing?success=true',
      'https://example.com/billing?canceled=true'
    );
    expect(NextResponse.json).toHaveBeenCalledWith({ url: mockCheckoutSession.url });
  });

  test('returns error if checkout session creation fails', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 1 } });
    (getUser as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      stripeCustomerId: 'cus_123',
    });

    (createCheckoutSession as jest.Mock).mockRejectedValue(new Error('Stripe API error'));

    const mockSearchParams = new URLSearchParams({ priceId: 'price_123' });
    const request = new NextRequest('https://example.com/api/subscription/checkout');
    (request as any).nextUrl = {
      searchParams: mockSearchParams,
    };

    // Act
    const _response = await POST(request);

    // Assert
    expect(getUser).toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledWith(
      'cus_123',
      'price_123',
      'https://example.com/billing?success=true',
      'https://example.com/billing?canceled=true'
    );
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  });
});
