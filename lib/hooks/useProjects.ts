'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectStore, type Project } from '@/lib/stores/projectStore';

interface UseProjectsOptions {
  userId: number;
  initialData?: Project[];
}

export function useProjects({ userId, initialData }: UseProjectsOptions) {
  const { setProjects } = useProjectStore();

  return useQuery<Project[]>({
    queryKey: ['projects', userId],
    queryFn: async () => {
      try {
        // In a real implementation, this would be an API call
        const response = await fetch(`/api/projects?userId=${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        const projects = data.projects || initialData || [];
        setProjects(projects);
        return projects;
      } catch (error) {
        console.error('Failed to fetch projects', error);
        // If API fails, fall back to initial data
        return initialData || [];
      }
    },
    placeholderData: initialData,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
  });
}

export function useProject(projectId: number) {
  return useQuery<Project, Error>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      const { data } = await response.json();
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    },
    staleTime: 1000 * 60, // Consider data stale after 1 minute
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { addProject } = useProjectStore();

  return useMutation<Project, Error, { prompt: string; name: string }>({
    mutationFn: async data => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      const project = await response.json();
      return {
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
      };
    },
    onSuccess: data => {
      addProject(data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { removeProject } = useProjectStore();

  return useMutation<number, Error, number>({
    mutationFn: async projectId => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }
      return projectId;
    },
    onSuccess: projectId => {
      removeProject(projectId);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { updateProject } = useProjectStore();

  return useMutation<Project, Error, { projectId: number; updates: Partial<Project> }>({
    mutationFn: async ({ projectId, updates }) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update project');
      }
      const project = await response.json();
      return {
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
      };
    },
    onSuccess: data => {
      updateProject(data.id, data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
}
