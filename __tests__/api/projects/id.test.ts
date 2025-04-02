import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getProjectById, updateProject, archiveProject } from '@/lib/db/projects';
import { GET, PATCH, DELETE } from '@/app/api/projects/[id]/route';
import { withProjectAccess } from '@/lib/auth/middleware';
import { setupNextResponseMock } from '../setup';

// Mock the dependencies
jest.mock('@/lib/db/projects');
jest.mock('@/lib/auth/middleware', () => ({
  withProjectAccess: (handler: any) => async (req: any, context: any) => {
    const mockSession = { user: { id: 1 } };
    return handler(req, context, mockSession);
  },
}));
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('next/server').NextRequest,
  NextResponse: {
    json: jest.fn(),
  },
}));

describe('/api/projects/[id] API route', () => {
  const mockProject = {
    id: 1,
    name: 'Test Project',
    description: 'Test Description',
    userId: 1,
    createdBy: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isArchived: false,
  };

  const mockContext = { project: mockProject, params: { id: '1' } };
  
  let restoreNextResponseMock: () => void;

  beforeEach(() => {
    jest.resetAllMocks();
    (getProjectById as jest.Mock).mockResolvedValue(mockProject);
    restoreNextResponseMock = setupNextResponseMock();
  });

  afterEach(() => {
    restoreNextResponseMock();
  });

  describe('GET /api/projects/[id]', () => {
    test('returns the project successfully', async () => {
      // Arrange
      const req = new NextRequest('http://localhost/api/projects/1');

      // Act
      const response = await GET(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData).toEqual({ data: mockProject });
      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /api/projects/[id]', () => {
    const updateData = {
      name: 'Updated Project',
      description: 'Updated Description',
    };

    test('updates the project with valid data', async () => {
      // Arrange
      const updatedProject = { ...mockProject, ...updateData };
      (updateProject as jest.Mock).mockResolvedValue(updatedProject);
      
      const req = new NextRequest('http://localhost/api/projects/1', {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      // Act
      const response = await PATCH(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(updateProject).toHaveBeenCalledWith(1, updateData);
      expect(responseData).toEqual({ data: updatedProject });
      expect(response.status).toBe(200);
    });

    test('returns validation error with invalid data', async () => {
      // Arrange
      const invalidData = {
        name: '' // Invalid name (too short)
      };
      
      const req = new NextRequest('http://localhost/api/projects/1', {
        method: 'PATCH',
        body: JSON.stringify(invalidData),
      });

      // Act
      const response = await PATCH(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(updateProject).not.toHaveBeenCalled();
      expect(responseData.error).toBe('Validation error');
      expect(response.status).toBe(400);
    });

    test('handles errors appropriately', async () => {
      // Arrange
      const error = new Error('Database error');
      (updateProject as jest.Mock).mockRejectedValue(error);
      
      const req = new NextRequest('http://localhost/api/projects/1', {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      // Act
      const response = await PATCH(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData.error).toBe('Internal server error');
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/[id]', () => {
    test('archives the project successfully', async () => {
      // Arrange
      const archivedProject = { ...mockProject, archivedAt: new Date() };
      (archiveProject as jest.Mock).mockResolvedValue(archivedProject);
      
      const req = new NextRequest('http://localhost/api/projects/1', {
        method: 'DELETE',
      });

      // Act
      const response = await DELETE(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(archiveProject).toHaveBeenCalledWith(1);
      expect(responseData).toEqual({ data: archivedProject });
      expect(response.status).toBe(200);
    });

    test('handles errors appropriately', async () => {
      // Arrange
      const error = new Error('Database error');
      (archiveProject as jest.Mock).mockRejectedValue(error);
      
      const req = new NextRequest('http://localhost/api/projects/1', {
        method: 'DELETE',
      });

      // Act
      const response = await DELETE(req, mockContext);
      const responseData = await response.json();

      // Assert
      expect(responseData.error).toBe('Internal server error');
      expect(response.status).toBe(500);
    });
  });
}); 