import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Plus, Settings, Activity, CheckCircle, AlertCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";

interface RCFeature {
  id: number;
  featureCode: string;
  rcKeyPath: string;
  type: 'bool' | 'string' | 'int' | 'json';
  defaultValue: string;
  status: 'active' | 'inactive';
  provider: string;
  lastUpdated: string;
}

const addFeatureSchema = z.object({
  featureCode: z.string().min(1, "Feature code is required").regex(/^[a-z_][a-z0-9_]*$/, "Feature code must be lowercase with underscores only"),
  rcKeyPath: z.string().min(1, "RC key path is required"),
  type: z.enum(['bool', 'string', 'int', 'json']),
  defaultValue: z.string().min(1, "Default value is required"),
  provider: z.string().min(1, "Provider is required"),
});

export default function RemoteConfig() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [addFeatureOpen, setAddFeatureOpen] = useState(false);
  const [editFeatureOpen, setEditFeatureOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<RCFeature | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof addFeatureSchema>>({
    resolver: zodResolver(addFeatureSchema),
    defaultValues: {
      featureCode: "",
      rcKeyPath: "",
      type: "bool",
      defaultValue: "",
      provider: "",
    },
  });

  const editForm = useForm<z.infer<typeof addFeatureSchema>>({
    resolver: zodResolver(addFeatureSchema),
    defaultValues: {
      featureCode: "",
      rcKeyPath: "",
      type: "bool",
      defaultValue: "",
      provider: "",
    },
  });

  const { data: features, isLoading } = useQuery<RCFeature[]>({
    queryKey: ['/api/rc-registry'],
    queryFn: async () => {
      const response = await fetch('/api/rc-registry');
      if (!response.ok) throw new Error('Failed to fetch RC features');
      return response.json();
    },
  });

  const { data: connectors } = useQuery({
    queryKey: ['/api/connectors'],
    queryFn: async () => {
      const response = await fetch('/api/connectors');
      if (!response.ok) throw new Error('Failed to fetch connectors');
      return response.json();
    },
  });

  const addFeatureMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addFeatureSchema>) => {
      const response = await apiRequest('POST', '/api/rc-registry', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rc-registry'] });
      setAddFeatureOpen(false);
      form.reset();
      toast({
        title: "Feature Added",
        description: "Remote config feature has been successfully added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add feature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addFeatureSchema> & { id: number }) => {
      const response = await apiRequest('PUT', `/api/rc-registry/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rc-registry'] });
      setEditFeatureOpen(false);
      setEditingFeature(null);
      editForm.reset();
      toast({
        title: "Feature Updated",
        description: "Remote config feature has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof addFeatureSchema>) => {
    addFeatureMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof addFeatureSchema>) => {
    if (!editingFeature) return;
    updateFeatureMutation.mutate({ ...data, id: editingFeature.id });
  };

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/rc-registry/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rc-registry'] });
      toast({
        title: "Feature Deleted",
        description: "Remote config feature has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete feature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditFeature = (feature: RCFeature) => {
    setEditingFeature(feature);
    editForm.reset({
      featureCode: feature.featureCode,
      rcKeyPath: feature.rcKeyPath,
      type: feature.type,
      defaultValue: feature.defaultValue,
      provider: feature.provider,
    });
    setEditFeatureOpen(true);
  };

  const handleDeleteFeature = (feature: RCFeature) => {
    if (confirm(`Are you sure you want to delete the feature "${feature.featureCode}"? This action cannot be undone.`)) {
      deleteFeatureMutation.mutate(feature.id);
    }
  };

  const filteredFeatures = features?.filter(feature => {
    const matchesSearch = feature.featureCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feature.rcKeyPath.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = selectedProvider === "all" || feature.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  }) || [];

  const getTypeColor = (type: string) => {
    const colors = {
      'bool': 'bg-green-100 text-green-800',
      'string': 'bg-blue-100 text-blue-800',
      'int': 'bg-purple-100 text-purple-800',
      'json': 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    return status === 'active' ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> :
      <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remote Config Registry</h1>
          <p className="text-gray-600 mt-1">Manage feature flags and configuration values</p>
        </div>
        <Dialog open={addFeatureOpen} onOpenChange={setAddFeatureOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Remote Config Feature</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="featureCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feature Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., checkout_flow_v2" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="rcKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RC Key Path</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., features.checkout.enabled" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bool">Boolean</SelectItem>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="int">Integer</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Value</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., true, Hello World, 42, {}" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="firebase">Firebase Remote Config</SelectItem>
                          <SelectItem value="launchdarkly">LaunchDarkly</SelectItem>
                          <SelectItem value="optimizely">Optimizely</SelectItem>
                          <SelectItem value="split">Split</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setAddFeatureOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addFeatureMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {addFeatureMutation.isPending ? "Adding..." : "Add Feature"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Feature Dialog */}
        <Dialog open={editFeatureOpen} onOpenChange={setEditFeatureOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Feature</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="featureCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feature Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., show_premium_offers" 
                          {...field} 
                          disabled // Feature codes shouldn't be editable after creation
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="rcKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RC Key Path</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., features.premium.enabled" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bool">Boolean</SelectItem>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="int">Integer</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="defaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Value</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., true, Hello World, 42, {}" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="firebase">Firebase Remote Config</SelectItem>
                          <SelectItem value="launchdarkly">LaunchDarkly</SelectItem>
                          <SelectItem value="optimizely">Optimizely</SelectItem>
                          <SelectItem value="split">Split</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditFeatureOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateFeatureMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {updateFeatureMutation.isPending ? "Updating..." : "Update Feature"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {connectors && Object.keys(connectors).map(provider => (
                  <SelectItem key={provider} value={provider}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Feature Registry ({filteredFeatures.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature Code</TableHead>
                    <TableHead>RC Key Path</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default Value</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeatures.map((feature) => (
                    <TableRow key={feature.id}>
                      <TableCell className="font-medium">{feature.featureCode}</TableCell>
                      <TableCell className="font-mono text-sm">{feature.rcKeyPath}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(feature.type)}>
                          {feature.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-32 truncate">
                        {feature.defaultValue}
                      </TableCell>
                      <TableCell>{feature.provider}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(feature.status)}
                          <span className="capitalize">{feature.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {feature.lastUpdated}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditFeature(feature)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteFeature(feature)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                No deployments yet. Launch your first experiment to see deployment history.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Registry Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Environment</Label>
                <Select defaultValue="production">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto-sync Interval</Label>
                <Select defaultValue="5min">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1min">1 minute</SelectItem>
                    <SelectItem value="5min">5 minutes</SelectItem>
                    <SelectItem value="15min">15 minutes</SelectItem>
                    <SelectItem value="30min">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}