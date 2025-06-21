import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Mic, Database, Settings, TestTube, CheckCircle2, ChevronDown, ChevronRight, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function IntegrationPanel() {
  const [slackOpen, setSlackOpen] = useState(false);
  const { toast } = useToast();

  // Query for Slack connection status
  const slackStatusQuery = useQuery({
    queryKey: ['/api/slack/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/slack/status');
      return response.json();
    },
    refetchInterval: 30000,
    retry: false
  });

  const testSlackMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/slack/test', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Slack Test Successful",
        description: data.message || "Test message sent to your Slack channel!"
      });
      slackStatusQuery.refetch();
    },
    onError: (error: any) => {
      const errorMessage = error.error || error.message || "Please check your Slack configuration and try again.";
      toast({
        title: "Slack Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
      slackStatusQuery.refetch();
    }
  });

  const handleTestSlack = () => {
    testSlackMutation.mutate();
  };

  const slackStatus = slackStatusQuery.data?.status === 'success';

  return (
    <div className="space-y-6">
      {/* Chat & Communication Services */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Chat & Communication</h2>
          <p className="text-sm text-muted-foreground">
            Connect to messaging platforms for real-time analytics and collaboration
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Slack Integration - Collapsible */}
          <Collapsible open={slackOpen} onOpenChange={setSlackOpen}>
            <Card className="cursor-pointer hover:shadow-md transition-all">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Slack</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {slackStatus ? "#analytics" : "Ready to connect"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={slackStatus ? "default" : "secondary"}>
                        {slackStatus ? "Connected" : "Ready"}
                      </Badge>
                      {slackOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {slackStatus && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Slack connection is working properly
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={handleTestSlack}
                      disabled={testSlackMutation.isPending}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {testSlackMutation.isPending ? "Testing..." : "Test Integration"}
                    </Button>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• Ask questions using natural language</p>
                      <p>• Real-time dashboard updates</p>
                      <p>• AI-powered intent classification</p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Microsoft Teams */}
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Microsoft Teams</CardTitle>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Discord */}
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Discord</CardTitle>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Input & Analysis Services */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Input & Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Additional ways to interact with your analytics platform
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Voice Commands */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <Mic className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Voice Commands</CardTitle>
                    <p className="text-sm text-muted-foreground">Beta</p>
                  </div>
                </div>
                <Badge variant="secondary">Beta</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Data Sources */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                    <Database className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Data Sources</CardTitle>
                    <p className="text-sm text-muted-foreground">5 connected</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* API Access */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">API Access</CardTitle>
                    <p className="text-sm text-muted-foreground">Configure</p>
                  </div>
                </div>
                <Badge variant="outline">Ready</Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Notification Services */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Alerts & Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Get notified about important changes and insights
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Email Notifications */}
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Email Alerts</CardTitle>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* SMS Notifications */}
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">SMS Alerts</CardTitle>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Webhook Integration */}
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Webhooks</CardTitle>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}