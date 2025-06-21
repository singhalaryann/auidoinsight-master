import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, BarChart3, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Experiment } from "@shared/schema";

interface ExperimentDetailModalProps {
  experiment: Experiment;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ExperimentDetailModal({
  experiment,
  isOpen,
  onClose,
  onUpdate
}: ExperimentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: experiment.name,
    hypothesis: experiment.hypothesis || "",
    primaryMetric: experiment.primaryMetric,
    duration: experiment.duration,
    observationWindow: experiment.observationWindow || 2
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateExperiment = useMutation({
    mutationFn: async (updates: Partial<Experiment>) => {
      const response = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update experiment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments'] });
      setIsEditing(false);
      onUpdate();
      toast({
        title: "Experiment updated",
        description: "Changes saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating experiment",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateExperiment.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      name: experiment.name,
      hypothesis: experiment.hypothesis || "",
      primaryMetric: experiment.primaryMetric,
      duration: experiment.duration,
      observationWindow: experiment.observationWindow || 2
    });
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'draft':
      case 'queued': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              {isEditing ? "Edit Experiment" : "Experiment Details"}
            </DialogTitle>
            <Badge className={getStatusColor(experiment.status)}>
              {experiment.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Experiment Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    <div className="text-sm text-foreground">{experiment.name}</div>
                  )}
                </div>
                
                {experiment.hypothesis && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Hypothesis</Label>
                    {isEditing ? (
                      <Textarea
                        value={formData.hypothesis}
                        onChange={(e) => setFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <div className="text-sm text-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {experiment.hypothesis}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metrics & Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Metrics & Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Primary Metric</Label>
                  {isEditing ? (
                    <Input
                      value={formData.primaryMetric}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryMetric: e.target.value }))}
                    />
                  ) : (
                    <div className="text-sm text-foreground">{experiment.primaryMetric}</div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Audience</Label>
                  <div className="text-sm text-foreground">
                    {(() => {
                      const audience = experiment.audience as any;
                      if (audience?.type === "all") return "All Users";
                      if (audience?.type === "cohort" && audience?.cohortId) return `Cohort ${audience.cohortId}`;
                      return "All Users";
                    })()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Duration (days)</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    />
                  ) : (
                    <div className="text-sm text-foreground">{experiment.duration} days</div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observation Window (days)</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={formData.observationWindow}
                      onChange={(e) => setFormData(prev => ({ ...prev, observationWindow: parseInt(e.target.value) || 0 }))}
                    />
                  ) : (
                    <div className="text-sm text-foreground">{experiment.observationWindow || 2} days</div>
                  )}
                </div>
                
                {experiment.cohortSize && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cohort Size</Label>
                    <div className="text-sm text-foreground">{experiment.cohortSize?.toLocaleString()} users</div>
                  </div>
                )}
                
                {experiment.exposurePercentage && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Exposure Percentage</Label>
                    <div className="text-sm text-foreground">{experiment.exposurePercentage}%</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          {experiment.variants && Array.isArray(experiment.variants) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Variants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {experiment.variants.map((variant: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="font-medium">{variant.name || `Variant ${index + 1}`}</div>
                      <div className="text-sm text-muted-foreground">{variant.allocation || variant.percentage || 50}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Created</Label>
                  <div className="text-sm text-foreground">
                    {experiment.createdAt ? new Date(experiment.createdAt).toLocaleDateString() : "N/A"}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Started</Label>
                  <div className="text-sm text-foreground">
                    {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : "Not started"}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Completed</Label>
                  <div className="text-sm text-foreground">
                    {experiment.completionDate ? new Date(experiment.completionDate).toLocaleDateString() : "Not completed"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateExperiment.isPending}>
                  {updateExperiment.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Edit Experiment
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}