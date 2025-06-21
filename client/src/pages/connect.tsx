import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import IntegrationPanel from "@/components/IntegrationPanel";
import ConnectProviderModal from "@/components/ConnectProviderModal";
import type { User } from "@shared/schema";

interface Provider {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'disconnected';
  projectName?: string;
  colorStrip: string;
}

export default function Connect() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const { data: connectors, refetch: refetchConnectors } = useQuery({
    queryKey: ['/api/connectors'],
    queryFn: async () => {
      const response = await fetch('/api/connectors');
      if (!response.ok) throw new Error('Failed to fetch connectors');
      const serverData = await response.json();
      
      // Check local storage for any recently connected providers
      const localConnectors = JSON.parse(localStorage.getItem('connectedProviders') || '{}');
      
      // Merge server data with local storage
      return { ...serverData, ...localConnectors };
    },
  });

  const providers: Provider[] = [
    {
      id: 'firebase',
      name: 'Firebase Remote Config',
      logo: '🔥',
      status: connectors?.firebase ? 'connected' : 'disconnected',
      projectName: connectors?.firebase?.projectName,
      colorStrip: '#FFA000'
    },
    {
      id: 'launchdarkly',
      name: 'LaunchDarkly',
      logo: '🚀',
      status: connectors?.launchdarkly ? 'connected' : 'disconnected',
      projectName: connectors?.launchdarkly?.projectName,
      colorStrip: '#5C6BC0'
    },
    {
      id: 'aws',
      name: 'AWS AppConfig',
      logo: '☁️',
      status: connectors?.aws ? 'connected' : 'disconnected',
      projectName: connectors?.aws?.applicationName,
      colorStrip: '#FF9900'
    }
  ];

  const handleConnect = (providerId: string) => {
    setSelectedProvider(providerId);
    setShowConnectModal(true);
  };

  const handleManage = (providerId: string) => {
    // Open provider management interface
    const managementUrls = {
      firebase: 'https://console.firebase.google.com',
      launchdarkly: 'https://app.launchdarkly.com',
      aws: 'https://console.aws.amazon.com/systems-manager/appconfig',
      optimizely: 'https://app.optimizely.com',
      split: 'https://app.split.io'
    };
    
    const url = managementUrls[providerId as keyof typeof managementUrls];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const response = await fetch(`/api/connectors/${providerId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to disconnect provider');
      return response.json();
    },
    onSuccess: (data, providerId) => {
      // Remove from local storage
      const existingConnectors = JSON.parse(localStorage.getItem('connectedProviders') || '{}');
      delete existingConnectors[providerId];
      localStorage.setItem('connectedProviders', JSON.stringify(existingConnectors));
      
      // Refresh connector status
      refetchConnectors();
      
      toast({
        title: "Provider Disconnected",
        description: `${providers.find(p => p.id === providerId)?.name} has been disconnected.`
      });
    },
    onError: (error) => {
      toast({
        title: "Disconnection Failed",
        description: error instanceof Error ? error.message : "Failed to disconnect provider",
        variant: "destructive"
      });
    }
  });

  const handleDisconnect = (providerId: string) => {
    disconnectMutation.mutate(providerId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading integrations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Connect Integrations</h1>
          <p className="text-muted-foreground">
            Connect your analytics platform to external services and data sources
          </p>
        </div>

        {/* Remote Config Providers */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Remote Config Providers</h2>
            <p className="text-sm text-muted-foreground">
              Connect to remote config services to enable experiment rollouts without app deployments
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <TooltipProvider key={provider.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-md transition-all border-l-4" 
                          style={{ borderLeftColor: provider.colorStrip }}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{provider.logo}</span>
                            <div>
                              <CardTitle className="text-base">{provider.name}</CardTitle>
                              {provider.projectName && (
                                <p className="text-sm text-muted-foreground">{provider.projectName}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={provider.status === 'connected' ? 'default' : 'secondary'}>
                            {provider.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {provider.status === 'connected' ? (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleManage(provider.id)}
                            >
                              Manage
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-600"
                              onClick={() => handleDisconnect(provider.id)}
                              disabled={disconnectMutation.isPending}
                            >
                              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => handleConnect(provider.id)}
                            className="w-full"
                          >
                            Connect
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    RC provider lets you roll out winning variants without a new build
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
        
        <IntegrationPanel />

        {/* Connect Provider Modal */}
        {showConnectModal && selectedProvider && (
          <ConnectProviderModal
            provider={providers.find(p => p.id === selectedProvider)!}
            open={showConnectModal}
            onOpenChange={setShowConnectModal}
          />
        )}
      </div>
    </div>
  );
}