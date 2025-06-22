import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

interface Project {
  id: number;
  name: string;
}

interface Session {
  userId: number;
  orgId: number;
  orgName: string;
  email: string;
  role: string;
}

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isProjectLoading, setIsProjectLoading] = useState<number | null>(null);

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    if (session) {
      const fetchProjects = async () => {
        try {
          const response = await fetch(`http://localhost:9000/api/projects/${session.orgId}`);
          if (!response.ok) throw new Error("Failed to fetch projects");
          const data = await response.json();
          setProjects(data);
        } catch (err: any) {
          setError(err.message);
        }
      };
      fetchProjects();
    }
  }, [session]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:9000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed");
      setSession({ ...data, email, orgName });
    } catch (err: any) { setError(err.message); }
    finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:9000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      setSession(data);
    } catch (err: any) { setError(err.message); }
    finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!session) return;
    setIsCreatingProject(true);
    try {
      const res = await fetch("http://localhost:9000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, orgId: session.orgId, projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Project creation failed");
      setProjects([...projects, data]);
      setProjectName("");
    } catch (err: any) { setError(err.message); }
    finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    setError("");
    if (!session) return;
    setIsProjectLoading(projectId);
    try {
      const res = await fetch(`http://localhost:9000/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete project");
      }

      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProjectLoading(null);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!session || editingProjectId === null) return;
    setIsProjectLoading(editingProjectId);
    try {
      const res = await fetch(`http://localhost:9000/api/projects/${editingProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, name: editingProjectName }),
      });

      const updatedProject = await res.json();
      if (!res.ok) throw new Error(updatedProject.message || "Failed to update project");

      setProjects(projects.map(p => p.id === editingProjectId ? updatedProject : p));
      handleCancelEdit();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProjectLoading(null);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setEmail("");
    setProjects([]);
  };

  if (session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-3xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Welcome, {session.email}</CardTitle>
              <CardDescription>Organization: {session.orgName}</CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              <Badge>{session.role.replace('_', ' ').toUpperCase()}</Badge>
              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-4">Your Projects</h3>
                <div className="space-y-2">
                  {projects.length > 0 ? (
                    projects.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                        {editingProjectId === p.id ? (
                          <form onSubmit={handleUpdateProject} className="flex-grow flex items-center space-x-2">
                            <Input value={editingProjectName} onChange={(e) => setEditingProjectName(e.target.value)} className="h-9" disabled={isProjectLoading === p.id} />
                            <Button type="submit" variant="ghost" size="icon" disabled={isProjectLoading === p.id}>
                              {isProjectLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={handleCancelEdit} disabled={isProjectLoading === p.id}><X className="h-4 w-4 text-red-500" /></Button>
                          </form>
                        ) : (
                          <>
                            <p className="font-medium">{p.name}</p>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditClick(p)} disabled={!!isProjectLoading}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(p.id)} disabled={!!isProjectLoading}>
                                {isProjectLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground p-3">No projects yet. Create one!</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Create a New Project</h3>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} required disabled={isCreatingProject} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreatingProject}>
                    {isCreatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </form>
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>Enter your email to access your projects.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email-login">Email</Label>
                  <Input id="email-login" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </CardContent>
          </TabsContent>
          <TabsContent value="signup">
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>Create an account and organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input id="email-signup" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required disabled={isLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign Up
                </Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </Card>
    </div>
  );
} 