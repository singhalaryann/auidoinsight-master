import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProjectRoleManagerProps {
  open: boolean;
  onClose: () => void;
  project: { id: number; name: string };
}

const ROLES = ["viewer", "editor", "analyst"];

export default function ProjectRoleManager({ open, onClose, project }: ProjectRoleManagerProps) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [loading, setLoading] = useState(false);

  // Fetch current roles for this project
  useEffect(() => {
    if (open && project?.id) {
      setLoading(true);
      apiRequest("GET", `/api/projects/${project.id}/roles`)
        .then(res => res.json())
        .then(data => setRoles(data))
        .catch(() => toast({ title: "Error", description: "Failed to fetch roles.", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [open, project, toast]);

  const handleAssign = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await apiRequest("POST", `/api/projects/${project.id}/roles`, { email, role });
      toast({ title: "Role assigned", description: `${email} is now a ${role}.` });
      setEmail("");
      setRole(ROLES[0]);
      // Refresh roles
      const res = await apiRequest("GET", `/api/projects/${project.id}/roles`);
      setRoles(await res.json());
    } catch {
      toast({ title: "Error", description: "Failed to assign role.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (email: string, role: string) => {
    setLoading(true);
    try {
      await apiRequest("DELETE", `/api/projects/${project.id}/roles`, { email, role });
      toast({ title: "Role removed", description: `${email} is no longer a ${role}.` });
      // Refresh roles
      const res = await apiRequest("GET", `/api/projects/${project.id}/roles`);
      setRoles(await res.json());
    } catch {
      toast({ title: "Error", description: "Failed to remove role.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle>Manage Roles for {project.name}</DialogTitle>
      <DialogContent>
        <div className="mb-4">
          <div className="flex gap-2 items-end">
            <Input
              placeholder="User email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
            <select
              className="border rounded px-2 py-1"
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={loading}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button size="sm" onClick={handleAssign} disabled={loading || !email}>Assign</Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.role}</TableCell>
                <TableCell>
                  <Button size="sm" variant="destructive" onClick={() => handleRemove(r.email, r.role)} disabled={loading}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
} 