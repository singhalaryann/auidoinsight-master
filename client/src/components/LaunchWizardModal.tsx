import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, Plus, Calendar, Rocket, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LaunchWizardModalProps {
  experiment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RCFeature {
  id: number;
  featureCode: string;
  rcKeyPath: string;
  type: 'bool' | 'string' | 'int' | 'json';
  defaultValue: string;
  provider: string;
}

export default function LaunchWizardModal({ experiment, open, onOpenChange }: LaunchWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    featureId: '',
    newFeatureCode: '',
    newFeaturePath: '',
    payload: '"basic"',
    payloadPreset: 'basic',
    trafficPercent: 100,
    autoRamp: false,
    rampCadence: '30min',
    scheduleDate: '',
    environment: 'prod',
    provider: ''
  });
  const { toast } = useToast();

  // Payload presets
  const payloadPresets = {
    basic: {
      name: 'Basic',
      description: 'Simple variant configuration',
      payload: '"basic"'
    },
    'ultra-strong': {
      name: 'Ultra-Strong',
      description: 'Enhanced variant with additional features',
      payload: '"ultra-strong"'
    }
  };

  const { data: features } = useQuery<RCFeature[]>({
    queryKey: ['/api/rc-registry'],
    queryFn: async () => {
      const response = await fetch('/api/rc-registry');
      if (!response.ok) throw new Error('Failed to fetch RC registry');
      return response.json();
    },
  });

  const { data: connectors } = useQuery({
    queryKey: ['/api/connectors'],
    queryFn: async () => {
      const response = await fetch('/api/connectors');
      if (!response.ok) throw new Error('Failed to fetch connectors');
      const serverData = await response.json();
      
      // Check local storage for connected providers
      const localConnectors = JSON.parse(localStorage.getItem('connectedProviders') || '{}');
      
      // Merge server data with local storage
      return { ...serverData, ...localConnectors };
    },
  });

  const availableProviders = Object.keys(connectors || {}).filter(key => connectors[key]);
  
  // Filter features to only show those from connected providers
  const connectedFeatures = features?.filter(feature => 
    connectors && connectors[feature.provider as keyof typeof connectors]
  ) || [];

  // Set default provider to first connected provider when connectors load
  useEffect(() => {
    if (availableProviders.length > 0 && !formData.provider) {
      setFormData(prev => ({ ...prev, provider: availableProviders[0] }));
    }
  }, [availableProviders, formData.provider]);

  const steps = [
    { number: 1, title: "Select Feature", description: "Choose RC feature for rollout" },
    { number: 2, title: "Configure Payload", description: "Set variant configuration" },
    { number: 3, title: "Roll-out Strategy", description: "Define traffic and timing" },
    { number: 4, title: "Review & Confirm", description: "Final review before launch" }
  ];

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleLaunch = async () => {
    try {
      const selectedFeature = connectedFeatures.find(f => f.id.toString() === formData.featureId);
      const payloadObj = JSON.parse(formData.payload);
      
      const response = await fetch('/api/rc-registry/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: experiment.id,
          providerId: formData.provider,
          featureId: formData.featureId,
          targetValue: payloadObj,
          environment: formData.environment,
          flagKey: selectedFeature?.rcKeyPath || formData.newFeaturePath,
          winnerKey: payloadObj.variant || 'variant_b',
          traffic: formData.trafficPercent / 100,
          projectKey: 'default'
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Rollout launched",
          description: result.message || `Feature successfully deployed to ${formData.provider}`
        });
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Launch failed');
      }
    } catch (error: any) {
      toast({
        title: "Launch failed",
        description: error.message || "Failed to launch experiment rollout",
        variant: "destructive"
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label>Select Feature</Label>
              <Select value={formData.featureId} onValueChange={(value) => {
                const selectedFeature = connectedFeatures.find(f => f.id.toString() === value);
                setFormData(prev => ({ 
                  ...prev, 
                  featureId: value,
                  provider: selectedFeature?.provider || prev.provider
                }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Search features..." />
                </SelectTrigger>
                <SelectContent>
                  {connectedFeatures.length > 0 ? (
                    connectedFeatures.map(feature => (
                      <SelectItem key={feature.id} value={feature.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <span>{feature.featureCode}</span>
                          <Badge variant="outline">{feature.type}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {feature.provider}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-features" disabled>
                      No features available from connected providers
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {!formData.featureId && (
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Create New Feature</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Feature Code</Label>
                    <Input
                      value={formData.newFeatureCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, newFeatureCode: e.target.value }))}
                      placeholder="e.g., booster_variant"
                    />
                  </div>
                  <div>
                    <Label>RC Key Path</Label>
                    <Input
                      value={formData.newFeaturePath}
                      onChange={(e) => setFormData(prev => ({ ...prev, newFeaturePath: e.target.value }))}
                      placeholder="e.g., loot.booster.variant"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        const selectedFeature = connectedFeatures.find(f => f.id.toString() === formData.featureId);
        return (
          <div className="space-y-4">
            <div>
              <Label>Payload Configuration</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Configure the winning variant payload
              </p>
              
              {/* Preset Options */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(payloadPresets).map(([key, preset]) => (
                  <div
                    key={key}
                    className={`relative border rounded-lg p-3 cursor-pointer transition-colors ${
                      formData.payloadPreset === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        payloadPreset: key,
                        payload: preset.payload
                      }));
                    }}
                  >
                    {formData.payloadPreset === key && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {preset.description}
                    </div>
                  </div>
                ))}
              </div>

              <Textarea
                value={formData.payload}
                onChange={(e) => setFormData(prev => ({ ...prev, payload: e.target.value }))}
                className="font-mono text-sm h-32"
                placeholder='{"variant": "variant_B"}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                JSON format required. This will be sent to your RC provider.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>Audience Exposure</Label>
              <div className="mt-2">
                <Slider
                  value={[formData.trafficPercent]}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, trafficPercent: value[0] }))}
                  max={100}
                  min={10}
                  step={25}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <p className="text-sm font-medium mt-2">{formData.trafficPercent}% traffic</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Ramp</Label>
                <p className="text-sm text-muted-foreground">Gradually increase to 100%</p>
              </div>
              <Switch
                checked={formData.autoRamp}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoRamp: checked }))}
              />
            </div>

            {formData.autoRamp && (
              <div>
                <Label>Ramp Cadence</Label>
                <Select value={formData.rampCadence} onValueChange={(value) => setFormData(prev => ({ ...prev, rampCadence: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">Every 15 minutes</SelectItem>
                    <SelectItem value="30min">Every 30 minutes</SelectItem>
                    <SelectItem value="1hour">Every hour</SelectItem>
                    <SelectItem value="6hours">Every 6 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Environment</Label>
              <Select value={formData.environment} onValueChange={(value) => setFormData(prev => ({ ...prev, environment: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod">Production</SelectItem>
                  <SelectItem value="stage">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                With current lift, 80% power reached at 50% traffic
              </AlertDescription>
            </Alert>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Launch Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium">{formData.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Feature:</span>
                  <span className="font-medium">{formData.featureId || formData.newFeatureCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Traffic:</span>
                  <span className="font-medium">{formData.trafficPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto-ramp:</span>
                  <span className="font-medium">{formData.autoRamp ? `Yes (${formData.rampCadence})` : 'No'}</span>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Payload:</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                    {JSON.stringify(JSON.parse(formData.payload), null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertDescription className="text-yellow-800">
                Previous RC version will be saved automatically for rollback
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  if (!availableProviders.length) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No RC Provider Connected</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Connect a Remote Config provider in the Connect tab to enable launches
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Go to Connect Tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Rocket className="h-5 w-5" />
            <span>Launch {experiment.name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep >= step.number 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
                }
              `}>
                {step.number}
              </div>
              <div className="ml-2 hidden sm:block">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="w-8 h-0.5 bg-gray-200 mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleLaunch} className="bg-blue-600 hover:bg-blue-700">
              <Rocket className="h-4 w-4 mr-1" />
              Ship Now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}