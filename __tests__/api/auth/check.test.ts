import { getSession } from '@/lib/auth/session';
import { GET } from '@/app/api/auth/check/route';
import { setupNextResponseMock } from '../setup';

// Mock the dependencies
jest.mock('@/lib/auth/session');
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

describe('/api/auth/check API route', () => {
  let restoreNextResponseMock: () => void;

  beforeEach(() => {
    jest.resetAllMocks();
    restoreNextResponseMock = setupNextResponseMock();
  });

  afterEach(() => {
    restoreNextResponseMock();
  });

  test('returns authenticated true when session exists', async () => {
    // Arrange
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    (getSession as jest.Mock).mockResolvedValue({ user: mockUser });

    // Act
    const response = await GET();
    const responseData = await response.json();

    // Assert
    expect(getSession).toHaveBeenCalled();
    expect(responseData).toEqual({
      authenticated: true,
      user: { id: 1 },
    });
    expect(response.status).toBe(200);
  });

  test('returns authenticated false when no session exists', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue(null);

    // Act
    const response = await GET();
    const responseData = await response.json();

    // Assert
    expect(getSession).toHaveBeenCalled();
    expect(responseData).toEqual({
      authenticated: false,
      user: null,
    });
    expect(response.status).toBe(200);
  });

  test('handles errors appropriately', async () => {
    // Arrange
    const error = new Error('Session error');
    (getSession as jest.Mock).mockRejectedValue(error);

    // Act
    const response = await GET();
    const responseData = await response.json();

    // Assert
    expect(getSession).toHaveBeenCalled();
    expect(responseData.error).toBe('Failed to check authentication');
    expect(response.status).toBe(500);
  });
});
