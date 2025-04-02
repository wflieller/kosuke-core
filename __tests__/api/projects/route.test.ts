import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getProjectsByUserId, createProject } from '@/lib/db/projects';
import { GET, POST } from '@/app/api/projects/route';
import { withAuth, RouteHandler } from '@/lib/auth/middleware';
import { setupNextResponseMock } from '../setup';

// Mock the dependencies
jest.mock('@/lib/auth/session');
jest.mock('@/lib/db/projects');
jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((handler: RouteHandler) => {
    return async (req: any, context: any) => {
      const mockSession = { user: { id: 1 } };
      return handler(req, context, mockSession);
    };
  }),
}));
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('next/server').NextRequest,
  NextResponse: {
    json: jest.fn(),
  },
}));

describe('/api/projects API route', () => {
  const mockContext = {};
  const mockProjects = [
    {
      id: 1,
      name: 'Project 1',
      description: 'Description 1',
      userId: 1,
      createdBy: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isArchived: false,
    },
    {
      id: 2,
      name: 'Project 2',
      description: 'Description 2',
      userId: 1,
      createdBy: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isArchived: false,
    },
  ];
  
  let restoreNextResponseMock: () => void;

  beforeEach(() => {
    jest.resetAllMocks();
    restoreNextResponseMock = setupNextResponseMock();
  });

  afterEach(() => {
    restoreNextResponseMock();
  });

  describe('GET /api/projects', () => {
    test('returns projects by user ID', async () => {
      // Arrange
      (getProjectsByUserId as jest.Mock).mockResolvedValue(mockProjects);
      const req = new NextRequest('http://localhost/api/projects?userId=1');

      // Act
      const response = await GET(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(getProjectsByUserId).toHaveBeenCalledWith(1);
      expect(responseData).toEqual(mockProjects);
    });

    test('returns 400 error when userId is missing', async () => {
      // Arrange
      const req = new NextRequest('http://localhost/api/projects');

      // Act
      const response = await GET(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData.error).toBe('User ID is required');
      expect(response.status).toBe(400);
    });

    test('handles errors appropriately', async () => {
      // Arrange
      const error = new Error('Database error');
      (getProjectsByUserId as jest.Mock).mockRejectedValue(error);
      const req = new NextRequest('http://localhost/api/projects?userId=1');

      // Act
      const response = await GET(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData.error).toBe('Failed to fetch projects');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    const validProject = {
      name: 'New Project',
      description: 'Description',
    };

    test('creates a new project with valid data', async () => {
      // Arrange
      const createdProject = {
        id: 3,
        ...validProject,
        userId: 1,
        createdBy: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        isArchived: false,
      };
      (createProject as jest.Mock).mockResolvedValue(createdProject);
      
      const req = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: validProject.name,
          description: validProject.description,
        }),
      });

      // Act
      const response = await POST(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(createProject).toHaveBeenCalledWith({
        name: validProject.name,
        description: validProject.description,
        userId: 1,
        createdBy: 1,
      });
      expect(responseData).toEqual({ data: { project: createdProject } });
      expect(response.status).toBe(201);
    });

    test('returns validation error with invalid data', async () => {
      // Arrange
      const invalidProject = {
        // Missing required 'name' field
      };
      
      const req = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(invalidProject),
      });

      // Act
      const response = await POST(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(createProject).not.toHaveBeenCalled();
      expect(responseData.error).toBe('Validation error');
      expect(responseData.code).toBe('VALIDATION_ERROR');
      expect(response.status).toBe(400);
    });

    test('handles database errors appropriately', async () => {
      // Arrange
      const error = new Error('Database error');
      (createProject as jest.Mock).mockRejectedValue(error);
      
      const req = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProject),
      });

      // Act
      const response = await POST(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData.error).toBe('Internal server error');
      expect(responseData.code).toBe('SERVER_ERROR');
      expect(response.status).toBe(500);
    });
  });
}); 