import express from "express";
import cors from "cors";
import "dotenv/config";
import { db } from "./db";
import { newUsers, organizations, usersToOrganizations, projects } from "../shared/schema";
import { oso } from "./oso";
import { eq } from "drizzle-orm";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const app = express();
app.use(cors());
app.use(express.json());

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

    // Tell Oso about the new user role
    // await oso.tell("has_role", 
    //   { type: "NewUser", id: createdUser.id.toString() },
    //   "org_owner",
    //   { type: "Organization", id: createdOrg.id.toString() }
    // );


    log(`Success: User ${createdUser.email} created for org ${orgName}. Oso Cloud told.`);
    res.status(201).send({ userId: createdUser.id, orgId: createdOrg.id });
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

    console.log(`Success: User ${email} logged in.`);
    res.status(200).send({ 
      userId: user.id, 
      orgId: organization.id,
      orgName: organization.name,
      email: user.email,
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

app.post("/api/projects", async (req, res) => {
  const { userId, orgId, projectName } = req.body;
  
  if (!userId || !orgId || !projectName) {
    return res.status(400).send({ message: "User ID, Org ID, and Project Name are required." });
  }

  try {
    // Check authorization with Oso
    await oso.authorize(
      { type: "NewUser", id: userId.toString() },
      "project:create",
      { type: "Organization", id: orgId.toString() }
    );

    log(`ALLOWED: User ${userId} can 'project:create' on Org ${orgId}.`);
    const [newProject] = await db.insert(projects).values({
      name: projectName,
      orgId: orgId,
    }).returning();

    res.status(201).send(newProject);
  } catch (error) {
    console.error("Project creation failed:", error);
    res.status(403).send({ message: "Forbidden: You do not have permission to create projects." });
  }
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

//