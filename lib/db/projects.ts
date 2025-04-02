import { eq, and, desc } from 'drizzle-orm';

import { db } from './drizzle';
import { projects, NewProject, Project, users } from './schema';

/**
 * Create a new project
 */
export async function createProject(project: NewProject): Promise<Project> {
  const [createdProject] = await db.insert(projects).values(project).returning();
  return createdProject;
}

/**
 * Get a project by ID
 */
export async function getProjectById(projectId: number): Promise<Project | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));

  return project;
}

/**
 * Get projects by user ID
 */
export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.isArchived, false)))
    .orderBy(desc(projects.updatedAt));
}

/**
 * Get projects by creator ID
 */
export async function getProjectsByCreatorId(creatorId: number): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.createdBy, creatorId), eq(projects.isArchived, false)))
    .orderBy(desc(projects.updatedAt));
}

/**
 * Update a project
 */
export async function updateProject(
  id: number,
  data: Partial<Omit<NewProject, 'id' | 'createdBy' | 'createdAt'>>
): Promise<Project | undefined> {
  const [updatedProject] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  return updatedProject;
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(id: number): Promise<Project | undefined> {
  const [archivedProject] = await db
    .update(projects)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  return archivedProject;
}

/**
 * Get project with creator details
 */
export async function getProjectWithDetails(id: number) {
  const result = await db
    .select({
      project: projects,
      creatorName: users.name,
      creatorEmail: users.email,
    })
    .from(projects)
    .leftJoin(users, eq(projects.createdBy, users.id))
    .where(eq(projects.id, id));

  return result[0];
}
