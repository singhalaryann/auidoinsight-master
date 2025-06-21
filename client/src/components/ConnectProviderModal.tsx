import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Check, AlertCircle } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'disconnected';
  projectName?: string;
  colorStrip: string;
}

interface ConnectProviderModalProps {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ConnectProviderModal({ provider, open, onOpenChange }: ConnectProviderModalProps) {
  const [credentials, setCredentials] = useState({
    apiKey: '',
    projectId: '',
    environment: 'production'
  });
  const [step, setStep] = useState<'credentials' | 'testing' | 'success'>('credentials');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async (data: typeof credentials) => {
      const response = await fetch(`/api/connectors/${provider.id}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        // Include detailed error information from the server
        const errorMsg = result.error || 'Failed to connect provider';
        const errorDetails = result.details ? JSON.stringify(result.details, null, 2) : '';
        throw new Error(`${errorMsg}${errorDetails ? '\n\nDetails:\n' + errorDetails : ''}`);
      }
      
      return result;
    },
    onSuccess: () => {
      setStep('success');
      
      // Save connection state to local storage
      const existingConnectors = JSON.parse(localStorage.getItem('connectedProviders') || '{}');
      existingConnectors[provider.id] = true;
      localStorage.setItem('connectedProviders', JSON.stringify(existingConnectors));
      
      // Invalidate both connectors and any dependent queries
      queryClient.invalidateQueries({ queryKey: ['/api/connectors'] });
      queryClient.refetchQueries({ queryKey: ['/api/connectors'] });
      toast({
        title: "Provider Connected",
        description: `${provider.name} has been successfully connected.`
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect provider",
        variant: "destructive"
      });
    }
  });

  const handleConnect = () => {
    if (!credentials.apiKey || !credentials.projectId) {
      toast({
        title: "Missing Information",
        description: "Please provide both API key and project ID",
        variant: "destructive"
      });
      return;
    }
    setStep('testing');
    connectMutation.mutate(credentials);
  };

  const handleClose = () => {
    setStep('credentials');
    setCredentials({ apiKey: '', projectId: '', environment: 'production' });
    // Force refresh of connector status before closing
    queryClient.invalidateQueries({ queryKey: ['/api/connectors'] });
    onOpenChange(false);
  };

  const getProviderInstructions = (providerId: string) => {
    const instructions = {
      firebase: {
        steps: [
          "Go to Firebase Console → Project Settings",
          "Navigate to Service Accounts tab",
          "Generate new private key",
          "Copy the project ID from General tab"
        ],
        docsUrl: "https://firebase.google.com/docs/remote-config/get-started"
      },
      launchdarkly: {
        steps: [
          "Go to LaunchDarkly Account Settings",
          "Navigate to Authorization tab",
          "Create new API access token",
          "Copy your project key from Projects page"
        ],
        docsUrl: "https://docs.launchdarkly.com/home/getting-started"
      },
      optimizely: {
        steps: [
          "Go to Optimizely Settings → Integrations",
          "Generate new API token",
          "Find project ID in project settings",
          "Ensure token has Full Access permissions"
        ],
        docsUrl: "https://docs.developers.optimizely.com/web/docs"
      },
      split: {
        steps: [
          "Go to Split Admin Settings",
          "Navigate to API Keys section",
          "Create new Admin API key",
          "Copy workspace ID from workspace settings"
        ],
        docsUrl: "https://help.split.io/hc/en-us/articles/360020564931"
      }
    };
    return instructions[providerId as keyof typeof instructions] || instructions.firebase;
  };

  const providerInstructions = getProviderInstructions(provider.id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded ${provider.colorStrip} flex items-center justify-center text-white font-bold`}>
                {provider.name.charAt(0)}
              </div>
              Connect {provider.name}
            </div>
          </DialogTitle>
        </DialogHeader>

        {step === 'credentials' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {providerInstructions.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <ExternalLink className="h-4 w-4 text-blue-600" />
                  <a 
                    href={providerInstructions.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View {provider.name} Documentation
                  </a>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key / Service Account Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key..."
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID / Workspace ID</Label>
                <Input
                  id="projectId"
                  placeholder="Enter your project ID..."
                  value={credentials.projectId}
                  onChange={(e) => setCredentials(prev => ({ ...prev, projectId: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <select
                  id="environment"
                  value={credentials.environment}
                  onChange={(e) => setCredentials(prev => ({ ...prev, environment: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleConnect}
                disabled={!credentials.apiKey || !credentials.projectId}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Test Connection
              </Button>
            </div>
          </div>
        )}

        {step === 'testing' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold">Testing Connection</h3>
              <p className="text-gray-600">Verifying your {provider.name} credentials...</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-600">Connection Successful!</h3>
              <p className="text-gray-600">
                {provider.name} is now connected and ready for Remote Config deployments.
              </p>
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-800">What's Next?</h4>
                    <p className="text-sm text-green-700">
                      You can now launch experiment winners directly to {provider.name} 
                      through the "Roll Out" button in experiment results.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}