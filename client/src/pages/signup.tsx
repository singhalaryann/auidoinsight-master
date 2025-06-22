import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Project {
  id: number;
  name: string;
}

interface Session {
  userId: number;
  orgId: number;
  orgName: string;
  email: string;
}

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!session) return;
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
  };

  if (session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Welcome, {session.email}</CardTitle>
            <CardDescription>Organization: {session.orgName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-4">Your Projects</h3>
                <ul className="list-disc list-inside bg-secondary/50 p-4 rounded-lg">
                  {projects.map(p => <li key={p.id}>{p.name}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Create a New Project</h3>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full">Create</Button>
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
                  <Input id="email-login" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">Login</Button>
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
                  <Input id="email-signup" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">Sign Up</Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </Card>
    </div>
  );
} 