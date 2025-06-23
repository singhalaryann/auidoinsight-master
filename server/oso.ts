import { Oso } from "oso-cloud";

if (!process.env.OSO_API_KEY) {
  console.warn("OSO_API_KEY is not set. Authorization will not be enforced.");
}

export const oso = new Oso('https://cloud.osohq.com', process.env.OSO_API_KEY || "dummy_api_key_for_dev");

/**
 * Assign a role to a user for a resource in Oso Cloud.
 * @param userEmail - The user's email
 * @param role - The role to assign (e.g., 'editor', 'viewer', 'analyst', 'org_owner')
 * @param resourceType - 'Organization' or 'Project'
 * @param resourceId - The resource's id (number or string)
 */
export async function assignRole(userEmail: string, role: string, resourceType: 'Organization' | 'Project', resourceId: string | number) {
  return oso.insert([
    'has_role',
    { type: 'User', id: userEmail },
    role,
    { type: resourceType, id: resourceId.toString() }
  ]);
}

/**
 * Remove a role from a user for a resource in Oso Cloud.
 * @param userEmail - The user's email
 * @param role - The role to remove
 * @param resourceType - 'Organization' or 'Project'
 * @param resourceId - The resource's id
 */
export async function removeRole(userEmail: string, role: string, resourceType: 'Organization' | 'Project', resourceId: string | number) {
  return oso.delete([
    'has_role',
    { type: 'User', id: userEmail },
    role,
    { type: resourceType, id: resourceId.toString() }
  ]);
}

/**
 * Remove all roles for a project (for cleanup on project deletion).
 * @param projectId - The project id
 * @param userRoles - Array of { email, role }
 */
export async function removeAllProjectRoles(projectId: string | number, userRoles: { email: string, role: string }[]) {
  for (const { email, role } of userRoles) {
    await removeRole(email, role, 'Project', projectId);
  }
}