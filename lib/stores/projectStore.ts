import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean | null;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: number) => void;
  updateProject: (projectId: number, updates: Partial<Project>) => void;
}

type ProjectPersist = (
  config: StateCreator<ProjectState>,
  options: PersistOptions<ProjectState>
) => StateCreator<ProjectState>;

export const useProjectStore = create<ProjectState>()(
  (persist as ProjectPersist)(
    (set): ProjectState => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
      setProjects: (projects: Project[]) => set({ projects }),
      setCurrentProject: (project: Project | null) => set({ currentProject: project }),
      setIsLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error }),
      addProject: (project: Project) =>
        set(state => ({
          projects: [...state.projects, project],
        })),
      removeProject: (projectId: number) =>
        set(state => ({
          projects: state.projects.filter(p => p.id !== projectId),
        })),
      updateProject: (projectId: number, updates: Partial<Project>) =>
        set(state => ({
          projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, ...updates }
              : state.currentProject,
        })),
    }),
    {
      name: 'project-storage',
    }
  )
);
