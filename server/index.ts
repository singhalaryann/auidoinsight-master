import express from "express";
import cors from "cors";
import "dotenv/config";
import { db } from "./db";
import { newUsers, organizations, usersToOrganizations, projects, usersToProjects } from "../shared/schema";
import { oso, assignRole, removeRole } from "./oso";
import { eq, and } from "drizzle-orm";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory session store (for demo only)
const sessions = new Map();

// Helper to get user from session
function getSessionUser(req: any) {
  const auth = req.headers["authorization"];
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  return sessions.get(token) || null;
}

// Helper to get org name by id
async function getOrgNameById(orgId: number) {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
  return org?.name || orgId.toString();
}

// Helper to get project name by id
async function getProjectNameById(projectId: number) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  return project?.name || projectId.toString();
}

// API Routes for Part 1
app.post("/api/signup", async (req, res) => {
  const { email, orgName } = req.body;
  
  if (!email || !orgName) {
    return res.status(400).send({ message: "Email and organization name are required" });
  }

  try {
    const existingUser = await db.query.newUsers.findFirst({ where: eq(newUsers.email, email) });
    if (existingUser) {
      return res.status(409).send({ message: "User with this email already exists" });
    }

    const { createdUser, createdOrg } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(newUsers).values({ email, name: email }).returning();
      const [org] = await tx.insert(organizations).values({ name: orgName }).returning();
      await tx.insert(usersToOrganizations).values({
        userId: user.id,
        orgId: org.id,
        role: "org_owner",
      });
      return { createdUser: user, createdOrg: org };
    });

    //Tell Oso about the new user role (use email as id)
    await assignRole(createdUser.email, "org_owner", "Organization", createdOrg.name);

    // Assign viewer role for all projects in this org (if any)
    const orgProjects = await db.query.projects.findMany({ where: eq(projects.orgId, createdOrg.id) });
    for (const project of orgProjects) {
      await db.insert(usersToProjects).values({ userId: createdUser.id, projectId: project.id, role: "viewer" });
      await assignRole(createdUser.email, "viewer", "Project", project.name);
    }

    // Create session
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, {
      userId: createdUser.id,
      orgId: createdOrg.id,
      orgName: createdOrg.name,
      email: createdUser.email,
      role: "org_owner"
    });

    log(`Success: User ${createdUser.email} created for org ${orgName}. Oso Cloud told.`);
    res.status(201).send({ 
      userId: createdUser.id, 
      orgId: createdOrg.id,
      orgName: createdOrg.name,
      email: createdUser.email,
      role: "org_owner",
      token
    });
  } catch (error) {
    console.error("Signup failed:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  try {
    // 1. Find the user by email
    const user = await db.query.newUsers.findFirst({ where: eq(newUsers.email, email) });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // 2. Find their organization link
    const userOrgLink = await db.query.usersToOrganizations.findFirst({
      where: eq(usersToOrganizations.userId, user.id),
    });

    if (!userOrgLink) {
      return res.status(404).send({ message: "Organization link not found for this user" });
    }

    // 3. Find the organization itself
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, userOrgLink.orgId),
    });

    if (!organization) {
      return res.status(404).send({ message: "Organization not found" });
    }

    // 4. Upsert Oso Cloud org_owner fact if needed
    if (userOrgLink.role === "org_owner") {
      await assignRole(user.email, "org_owner", "Organization", organization.name);
    }

    // Create session
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, {
      userId: user.id,
      orgId: organization.id,
      orgName: organization.name,
      email: user.email,
      role: userOrgLink.role
    });

    console.log(`Success: User ${email} logged in.`);
    res.status(200).send({ 
      userId: user.id, 
      orgId: organization.id,
      orgName: organization.name,
      email: user.email,
      role: userOrgLink.role,
      token
    });

  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/api/projects/:orgId", async (req, res) => {
  const { orgId } = req.params;

  try {
    const projectList = await db.query.projects.findMany({
      where: eq(projects.orgId, Number(orgId)),
    });

    res.status(200).send(projectList);

  } catch (error) {
    console.error("Failed to fetch projects:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.put("/api/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  let { name, userId, email, orgName } = req.body;

  if (!name || !userId || !email || !orgName) {
    return res.status(400).send({ message: "Project name, userId, orgName, and email are required" });
  }
  if (Array.isArray(email)) email = email[0];
  
  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, Number(projectId)) });
    if (!project) {
      return res.status(404).send({ message: "Project not found" });
    }

    // Authorize this action with Oso
    await oso.authorize(
      { type: "User", id: email },
      "project:edit",
      { type: "Organization", id: orgName }
    );

    const [updatedProject] = await db.update(projects)
      .set({ name })
      .where(eq(projects.id, Number(projectId)))
      .returning();

    // Update Oso Cloud facts for all users/roles on this project
    if (updatedProject) {
      console.log('[Project Rename] Old project name:', project.name, 'New project name:', name);
      // 1. Get all user-role pairs for this project
      const userRoles = await db.query.usersToProjects.findMany({ where: eq(usersToProjects.projectId, Number(projectId)) });
      for (const ur of userRoles) {
        // Get user email
        const user = await db.query.newUsers.findFirst({ where: eq(newUsers.id, ur.userId) });
        if (user) {
          console.log(`[Project Rename] Updating Oso facts for user: ${user.email}, role: ${ur.role}`);
          // Remove old fact (with old project name)
          try {
            await removeRole(user.email, ur.role, "Project", project.name);
            console.log(`[Project Rename] Removed old Oso fact for ${user.email}, role: ${ur.role}, project: ${project.name}`);
          } catch (err) {
            console.error(`[Project Rename] Failed to remove old Oso fact for ${user.email}, role: ${ur.role}, project: ${project.name}`, err);
          }
          // Add new fact (with new project name)
          try {
            await assignRole(user.email, ur.role, "Project", name);
            console.log(`[Project Rename] Added new Oso fact for ${user.email}, role: ${ur.role}, project: ${name}`);
          } catch (err) {
            console.error(`[Project Rename] Failed to add new Oso fact for ${user.email}, role: ${ur.role}, project: ${name}`, err);
          }
        }
      }
    }

    res.status(200).send(updatedProject);
  } catch (error) {
    console.error("Failed to update project:", error);
    res.status(403).send({ message: "Forbidden or server error." });
  }
});

app.delete("/api/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  let { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).send({ message: "userId and email are required" });
  }
  if (Array.isArray(email)) email = email[0];

  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, Number(projectId)) });
    if (!project) {
      return res.status(404).send({ message: "Project not found" });
    }

    // Authorize this action with Oso
    await oso.authorize(
      { type: "User", id: email },
      "project:delete",
      { type: "Organization", id: await getOrgNameById(project.orgId) }
    );

    // Remove all project roles from Oso
    const userRoles = await db.query.usersToProjects.findMany({ where: eq(usersToProjects.projectId, Number(projectId)) });
    for (const ur of userRoles) {
      const user = await db.query.newUsers.findFirst({ where: eq(newUsers.id, ur.userId) });
      if (user) {
        const projectNameForRole = await getProjectNameById(Number(projectId));
        await removeRole(user.email, ur.role, "Project", projectNameForRole);
      }
    }
    await db.delete(projects).where(eq(projects.id, Number(projectId)));

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete project:", error);
    res.status(403).send({ message: "Forbidden or server error." });
  }
});

app.post("/api/projects", async (req, res) => {
  let { userId, orgId, orgName, projectName, email } = req.body;
  
  // Add robust logging
  console.log('Create project request:', { userId, orgId, orgName, projectName, email });

  if (!userId || !orgId || !orgName || !projectName || !email) {
    return res.status(400).send({ message: "User ID, Org ID, Org Name, Project Name, and email are required." });
  }
  if (Array.isArray(email)) email = email[0];

  try {
    // Check authorization with Oso
    await oso.authorize(
      { type: "User", id: email },
      "project:create",
      { type: "Organization", id: orgName }
    );

    log(`ALLOWED: User ${userId} can 'project:create' on Org ${orgId}.`);
    const [newProject] = await db.insert(projects).values({
      name: projectName,
      orgId: orgId,
    }).returning();

    // Assign org_owner all project roles in DB and Oso, including viewer
    const orgOwner = await db.query.usersToOrganizations.findFirst({ where: eq(usersToOrganizations.orgId, orgId) });
    if (orgOwner) {
      const ownerUser = await db.query.newUsers.findFirst({ where: eq(newUsers.id, orgOwner.userId) });
      if (ownerUser) {
        const roles = ["viewer", "editor", "analyst"];
        for (const role of roles) {
          const projectNameForRole = await getProjectNameById(Number(newProject.id));
          await db.insert(usersToProjects).values({ userId: ownerUser.id, projectId: newProject.id, role });
          await assignRole(ownerUser.email, role, "Project", projectNameForRole);
        }
      }
    }
    res.status(201).send(newProject);
  } catch (error) {
    console.error("Project creation failed:", error);
    res.status(403).send({ message: "Forbidden: You do not have permission to create projects." });
  }
});

// Assign a role to a user for a project
app.post("/api/projects/:projectId/roles", async (req, res) => {
  const { projectId } = req.params;
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).send({ message: "Email and role are required." });
  try {
    const user = await db.query.newUsers.findFirst({ where: eq(newUsers.email, email) });
    if (!user) return res.status(404).send({ message: "User not found." });
    const projectNameForRole = await getProjectNameById(Number(projectId));
    await db.insert(usersToProjects).values({ userId: user.id, projectId: Number(projectId), role });
    await assignRole(email, role, "Project", projectNameForRole);
    res.status(200).send({ message: "Role assigned." });
  } catch (error) {
    res.status(500).send({ message: "Failed to assign role." });
  }
});

// Remove a role from a user for a project
app.delete("/api/projects/:projectId/roles", async (req, res) => {
  const { projectId } = req.params;
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).send({ message: "Email and role are required." });
  try {
    const user = await db.query.newUsers.findFirst({ where: eq(newUsers.email, email) });
    if (!user) return res.status(404).send({ message: "User not found." });
    const projectNameForRole = await getProjectNameById(Number(projectId));
    await db.delete(usersToProjects).where(
      and(
        eq(usersToProjects.userId, user.id),
        eq(usersToProjects.projectId, Number(projectId)),
        eq(usersToProjects.role, role)
      )
    );
    await removeRole(email, role, "Project", projectNameForRole);
    res.status(200).send({ message: "Role removed." });
  } catch (error) {
    res.status(500).send({ message: "Failed to remove role." });
  }
});

// Get all roles for a project (for ProjectRoleManager UI)
app.get("/api/projects/:projectId/roles", async (req, res) => {
  const { projectId } = req.params;
  try {
    const userRoles = await db.query.usersToProjects.findMany({ where: eq(usersToProjects.projectId, Number(projectId)) });
    const result = await Promise.all(userRoles.map(async (ur) => {
      const user = await db.query.newUsers.findFirst({ where: eq(newUsers.id, ur.userId) });
      return user ? { email: user.email, role: ur.role } : null;
    }));
    res.status(200).send(result.filter(Boolean));
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch roles." });
  }
});

// Get projects the current user can access (filtered by Oso Cloud)
app.get("/api/my-projects", async (req, res) => {
  // For demo, get user email from query param (replace with real auth in production)
  let email = typeof req.query.email === 'string' ? req.query.email : Array.isArray(req.query.email) ? req.query.email[0] : undefined;
  if (!email) return res.status(400).send({ message: "Email is required" });
  if (Array.isArray(email)) email = email[0];
  email = email as string;
  try {
    // List all project IDs the user can view
    const projectIds = await oso.list({ type: "User", id: email }, "project:view", "Project");
    if (!Array.isArray(projectIds)) return res.status(200).send([]);
    // Fetch all projects and filter in JS
    const allProjects = await db.query.projects.findMany();
    const projectsList = allProjects.filter(p => projectIds.includes(p.id.toString()));
    res.status(200).send(projectsList);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch projects." });
  }
});

// Get current session user
app.get("/api/user", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).send({ message: "Not logged in" });
  res.status(200).send(user);
});

const PORT = process.env.PORT || 9000;
const server = createServer(app);

server.listen(PORT, async () => {
  log(`Server listening on port ${PORT}`);
  log("Oso Cloud authorization is ready!");

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
    log("Vite dev server setup complete - serving React frontend");
  } else {
    serveStatic(app);
    log("Serving static frontend files");
  }
});