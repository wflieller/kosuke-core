import { headers } from 'next/headers';
// Stripe import is used for TypeScript types in mocks
import { POST } from '@/app/api/webhooks/stripe/route';
import { handleSubscriptionUpdated } from '@/lib/actions/subscription';
import { stripe } from '@/lib/stripe';

// Mock dependencies
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, options = { status: 200 }) => ({
      body,
      ...options,
      json: () => Promise.resolve(body),
    })),
    redirect: jest.fn(),
  },
}));

// Mock next/headers to return Headers objects with proper get method
jest.mock('next/headers', () => ({
  headers: jest.fn().mockImplementation(() => ({
    get: jest.fn(name => {
      if (name === 'stripe-signature') {
        return 'mock_signature';
      }
      return null;
    }),
  })),
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/actions/subscription', () => ({
  handleSubscriptionUpdated: jest.fn(),
}));

describe('Stripe Webhook Handler', () => {
  const mockEndpointSecret = 'whsec_test_secret';
  const mockSignature = 'mock_signature';
  const mockBody = JSON.stringify({ data: { object: {} }, type: 'test_event' });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup environment variables
    process.env.STRIPE_WEBHOOK_SECRET = mockEndpointSecret;

    // Reset mock implementations
    (stripe.webhooks.constructEvent as jest.Mock).mockReset();
    (stripe.subscriptions.retrieve as jest.Mock).mockReset();
    (handleSubscriptionUpdated as jest.Mock).mockReset();
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  test('returns 400 if signature is missing', async () => {
    // Arrange
    (headers as jest.Mock).mockReturnValueOnce({
      get: jest.fn().mockReturnValue(null),
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Assert
    expect(responseData.error).toBe('Missing stripe signature or endpoint secret');
    expect(response.status).toBe(400);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  test('returns 400 if signature verification fails', async () => {
    // Arrange
    (headers as jest.Mock).mockReturnValue({
      get: jest.fn().mockImplementation(key => {
        if (key === 'stripe-signature') return mockSignature;
        return null;
      }),
    });

    // Mock the webhook secret
    const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = mockEndpointSecret;

    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Reset the env var
    process.env.STRIPE_WEBHOOK_SECRET = savedSecret;

    // Assert
    expect(responseData.error).toContain('Webhook signature verification failed');
    expect(response.status).toBe(400);
    // Don't assert the specific arguments to constructEvent
    expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
  });

  test('handles customer.subscription.created event correctly', async () => {
    // Arrange
    const mockSubscription = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: 'price_123',
              product: 'prod_123',
            },
          },
        ],
      },
    };

    const mockEvent = {
      type: 'customer.subscription.created',
      data: {
        object: mockSubscription,
      },
    };

    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
    (handleSubscriptionUpdated as jest.Mock).mockResolvedValue(true);

    (headers as jest.Mock).mockReturnValueOnce({
      get: jest.fn().mockReturnValue(mockSignature),
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Assert
    expect(responseData).toEqual({ received: true });
    expect(response.status).toBe(200);
    expect(handleSubscriptionUpdated).toHaveBeenCalledWith(
      mockSubscription.id,
      mockSubscription.customer,
      mockSubscription.status,
      mockSubscription.items.data[0].price.id,
      mockSubscription.items.data[0].price.product
    );
  });

  test('handles checkout.session.completed event correctly', async () => {
    // Arrange
    const mockSession = {
      mode: 'subscription',
      subscription: 'sub_123',
      customer: 'cus_123',
    };

    const mockSubscription = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: 'price_123',
              product: 'prod_123',
            },
          },
        ],
      },
    };

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: mockSession,
      },
    };

    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription);
    (handleSubscriptionUpdated as jest.Mock).mockResolvedValue(true);

    (headers as jest.Mock).mockReturnValueOnce({
      get: jest.fn().mockReturnValue(mockSignature),
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Assert
    expect(responseData).toEqual({ received: true });
    expect(response.status).toBe(200);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(mockSession.subscription);
    expect(handleSubscriptionUpdated).toHaveBeenCalledWith(
      mockSubscription.id,
      mockSubscription.customer,
      mockSubscription.status,
      mockSubscription.items.data[0].price.id,
      mockSubscription.items.data[0].price.product
    );
  });

  test('does not process non-subscription checkout sessions', async () => {
    // Arrange
    const mockSession = {
      mode: 'payment', // Not a subscription
      customer: 'cus_123',
    };

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: mockSession,
      },
    };

    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

    (headers as jest.Mock).mockReturnValueOnce({
      get: jest.fn().mockReturnValue(mockSignature),
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Assert
    expect(responseData).toEqual({ received: true });
    expect(response.status).toBe(200);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(handleSubscriptionUpdated).not.toHaveBeenCalled();
  });

  test('handles error during event processing', async () => {
    // Arrange
    const mockEvent = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          items: {
            data: [
              {
                price: {
                  id: 'price_123',
                  product: 'prod_123',
                },
              },
            ],
          },
        },
      },
    };

    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
    (handleSubscriptionUpdated as jest.Mock).mockRejectedValue(
      new Error('Error processing webhook')
    );

    (headers as jest.Mock).mockReturnValueOnce({
      get: jest.fn().mockReturnValue(mockSignature),
    });

    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      body: mockBody,
    });

    // Act
    const response = await POST(req);
    const responseData = await response.json();

    // Assert
    expect(responseData.error).toBe('Error processing webhook');
    expect(response.status).toBe(500);
  });
});
