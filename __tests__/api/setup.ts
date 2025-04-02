import { NextResponse } from 'next/server';

/**
 * Helper function to create a mock response with json method
 */
export function createMockResponse(body: any, options?: { status?: number }) {
  return {
    body,
    status: options?.status || 200,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  };
}

/**
 * Helper function to mock NextResponse.json
 */
export function setupNextResponseMock() {
  const originalNextResponse = NextResponse.json;

  // Mock NextResponse.json to return our custom response
  (NextResponse.json as jest.Mock) = jest.fn((body, options) => {
    return createMockResponse(body, options);
  });

  return () => {
    NextResponse.json = originalNextResponse;
  };
}

/**
 * Helper function to simplify API route testing
 */
export async function testApiRoute<T>(
  routeHandler: () => Promise<any>,
  expectedData: T,
  options?: { status?: number }
) {
  const mockRestore = setupNextResponseMock();

  try {
    const response = await routeHandler();
    const data = await response.json();

    expect(data).toEqual(expectedData);
    expect(response.status).toBe(options?.status || 200);

    return { response, data };
  } finally {
    mockRestore();
  }
}
