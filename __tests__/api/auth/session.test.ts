import { getSession } from '@/lib/auth/session';
import { GET } from '@/app/api/auth/session/route';
import { setupNextResponseMock } from '../setup';

// Mock the dependencies
jest.mock('@/lib/auth/session');
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

describe('/api/auth/session API route', () => {
  let restoreNextResponseMock: () => void;

  beforeEach(() => {
    jest.resetAllMocks();
    restoreNextResponseMock = setupNextResponseMock();
  });

  afterEach(() => {
    restoreNextResponseMock();
  });

  test('returns the user session when authenticated', async () => {
    // Arrange
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    (getSession as jest.Mock).mockResolvedValue({ user: mockUser });

    // Act
    const response = await GET();
    const responseData = await response.json();

    // Assert
    expect(getSession).toHaveBeenCalled();
    expect(responseData).toEqual({ user: mockUser });
    expect(response.status).toBe(200);
  });

  test('returns null user when not authenticated', async () => {
    // Arrange
    (getSession as jest.Mock).mockResolvedValue(null);

    // Act
    const response = await GET();
    const responseData = await response.json();

    // Assert
    expect(getSession).toHaveBeenCalled();
    expect(responseData).toEqual({ user: null });
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
    expect(responseData.error).toBe('Failed to fetch session');
    expect(response.status).toBe(500);
  });
});
