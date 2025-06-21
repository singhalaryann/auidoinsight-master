import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Upload, Info, PieChart, Lightbulb, FileUp, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const experimentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hypothesis: z.string().min(1, "Hypothesis is required"),
  variants: z.array(z.object({
    name: z.string(),
    allocation: z.number().min(0).max(100),
  })).min(2),
  audience: z.enum(["all", "cohort", "csv"]),
  cohortId: z.string().optional(),
  cohortExposurePct: z.number().min(1).max(100).default(100),
  csvFile: z.any().optional(),
  primaryMetric: z.string().min(1, "Primary metric is required"),
  secondaryMetrics: z.array(z.string()),
  duration: z.number().min(1, "Duration must be at least 1 day"),
  observationWindow: z.number().min(0).max(365).default(0),
});

type ExperimentFormData = z.infer<typeof experimentSchema>;

const STEP_TITLES = [
  "1 · Name & Objective",
  "2 · Audience", 
  "3 · Variants & Traffic",
  "4 · Metrics & Duration",
  "5 · Review & Launch"
];

const PRIMARY_METRICS = [
  { value: "retention_rate", label: "Retention Rate" },
  { value: "conversion_rate", label: "Conversion Rate" },
  { value: "revenue_per_user", label: "Revenue Per User" },
  { value: "session_duration", label: "Session Duration" },
  { value: "engagement_score", label: "Engagement Score" },
  { value: "dau", label: "Daily Active Users" },
  { value: "ltv", label: "Lifetime Value" },
];

const SECONDARY_METRICS = [
  { value: "session_count", label: "Session Count" },
  { value: "time_to_first_action", label: "Time to First Action" },
  { value: "feature_adoption", label: "Feature Adoption" },
  { value: "churn_rate", label: "Churn Rate" },
  { value: "purchase_frequency", label: "Purchase Frequency" },
  { value: "social_shares", label: "Social Shares" },
];

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center space-x-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-colors ${
            i < currentStep
              ? "bg-primary"
              : i === currentStep
              ? "bg-primary"
              : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function VariantCard({ 
  variant, 
  index, 
  onUpdate, 
  onDelete, 
  canDelete 
}: { 
  variant: { name: string; allocation: number };
  index: number;
  onUpdate: (name: string, allocation: number) => void;
  onDelete?: () => void;
  canDelete: boolean;
}) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Input
            value={variant.name}
            onChange={(e) => onUpdate(e.target.value, variant.allocation)}
            className="text-sm font-medium border-none p-0 h-auto focus-visible:ring-0"
            placeholder={index === 0 ? "Control" : `Variant ${String.fromCharCode(65 + index)}`}
          />
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold text-center">
          {variant.allocation}%
        </div>
      </CardContent>
    </Card>
  );
}

function TrafficSplitVisualizer({ variants }: { variants: Array<{ name: string; allocation: number }> }) {
  const colors = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];
  
  return (
    <div className="flex items-center gap-4">
      <PieChart className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted flex">
        {variants.map((variant, index) => (
          <div
            key={index}
            className="transition-all duration-300"
            style={{
              width: `${variant.allocation}%`,
              backgroundColor: colors[index % colors.length],
            }}
          />
        ))}
      </div>
      <div className="text-sm text-muted-foreground">
        {variants.reduce((sum, v) => sum + v.allocation, 0)}%
      </div>
    </div>
  );
}

export default function ExperimentWizard({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSuccess: () => void; 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [variants, setVariants] = useState([
    { name: "Control", allocation: 50 },
    { name: "Variant B", allocation: 50 }
  ]);
  const [selectedSecondaryMetrics, setSelectedSecondaryMetrics] = useState<string[]>([]);
  
  // Hypothesis clarity assist
  const [showHypothesisModal, setShowHypothesisModal] = useState(false);
  const [hypothesisSuggestions, setHypothesisSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [isLoadingHypothesis, setIsLoadingHypothesis] = useState(false);
  const [hypothesisQuality, setHypothesisQuality] = useState<any>(null);
  const [editableSuggestions, setEditableSuggestions] = useState<string[]>([]);
  const [editableHypothesis, setEditableHypothesis] = useState("");
  
  // Cohort management
  const [showCohortCreator, setShowCohortCreator] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [cohortFile, setCohortFile] = useState<File | null>(null);
  const [cohortExposure, setCohortExposure] = useState([100]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [userIdColumn, setUserIdColumn] = useState("");
  const [groupColumn, setGroupColumn] = useState("");
  const [controlValue, setControlValue] = useState("");
  const [variantValue, setVariantValue] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch available cohorts
  const { data: cohorts = [] } = useQuery({
    queryKey: ['/api/cohorts'],
    queryFn: async () => {
      const response = await fetch('/api/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      return response.json();
    },
  });

  // Hypothesis clarity assist functions
  const checkHypothesisClarity = async (hypothesis: string) => {
    if (!hypothesis || hypothesis.trim().length === 0) {
      return false; // Block progression for empty hypothesis
    }

    setIsLoadingHypothesis(true);
    try {
      const response = await fetch('/api/refine-hypothesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesis })
      });
      const data = await response.json();
      
      // Show modal if hypothesis is ambiguous (missing components)
      if (data.is_ambiguous) {
        setHypothesisSuggestions([data.suggested_hypothesis]);
        setEditableSuggestions([data.suggested_hypothesis]);
        setEditableHypothesis(data.suggested_hypothesis);
        setHypothesisQuality({
          is_ambiguous: true,
          missing_pieces: data.missing_pieces,
          suggested_hypothesis: data.suggested_hypothesis
        });
        setShowHypothesisModal(true);
        return false; // Block progression
      }
      
      return true; // Allow progression
    } catch (error) {
      console.error('Error refining hypothesis:', error);
      // On error, allow progression but flag for review
      return true;
    } finally {
      setIsLoadingHypothesis(false);
    }
  };

  const applySuggestions = () => {
    const currentHypothesis = form.getValues('hypothesis');
    const newHypothesis = currentHypothesis + '\n\n' + selectedSuggestions.map(s => `• ${s}`).join('\n');
    form.setValue('hypothesis', newHypothesis);
    setShowHypothesisModal(false);
    setSelectedSuggestions([]);
    toast({
      title: "Hypothesis refined ✓",
      description: "Added clarity suggestions to your hypothesis.",
    });
  };

  // Parse CSV headers when file is uploaded
  const handleCohortFileChange = async (file: File | null) => {
    setCohortFile(file);
    if (file) {
      try {
        const text = await file.text();
        const lines = text.split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(header => header.trim());
          setCsvHeaders(headers);
          // Auto-select common column names
          const userIdCol = headers.find(h => h.toLowerCase().includes('user') || h.toLowerCase().includes('id')) || headers[0];
          const groupCol = headers.find(h => h.toLowerCase().includes('group') || h.toLowerCase().includes('variant') || h.toLowerCase().includes('treatment')) || '';
          setUserIdColumn(userIdCol);
          setGroupColumn(groupCol);
        }
      } catch (error) {
        console.error('Error parsing CSV headers:', error);
      }
    } else {
      setCsvHeaders([]);
      setUserIdColumn("");
      setGroupColumn("");
      setControlValue("");
      setVariantValue("");
    }
  };

  // Cohort management functions
  const createCohort = async () => {
    if (!newCohortName || !cohortFile || !userIdColumn) return;
    
    try {
      const formData = new FormData();
      formData.append('csvFile', cohortFile);
      formData.append('name', newCohortName);
      formData.append('userIdColumn', userIdColumn);
      if (groupColumn && groupColumn !== "none") {
        formData.append('groupColumn', groupColumn);
        if (controlValue) formData.append('controlValue', controlValue);
        if (variantValue) formData.append('variantValue', variantValue);
      }
      
      const response = await fetch('/api/cohorts/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to create cohort');
      
      const newCohort = await response.json();
      await queryClient.invalidateQueries({ queryKey: ['/api/cohorts'] });
      
      toast({
        title: `Cohort '${newCohortName}' added ✓`,
        description: newCohort.hasGroupAssignments 
          ? `Created cohort with ${newCohort.size} users (${newCohort.controlCount} control, ${newCohort.variantCount} variant).`
          : `Created cohort with ${newCohort.size} users.`,
      });
      
      setShowCohortCreator(false);
      setNewCohortName("");
      setCohortFile(null);
      setCsvHeaders([]);
      setUserIdColumn("");
      setGroupColumn("");
      setControlValue("");
      setVariantValue("");
      
      // Wait a moment for the query to refetch, then set the value
      setTimeout(() => {
        form.setValue('cohortId', newCohort.id.toString());
      }, 100);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create cohort.",
        variant: "destructive",
      });
    }
  };

  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      name: "",
      hypothesis: "",
      variants: variants,
      audience: "all",
      cohortId: "all",
      cohortExposurePct: 100,
      primaryMetric: "",
      secondaryMetrics: [],
      duration: 7,
      observationWindow: 0,
    },
  });

  const createExperiment = useMutation({
    mutationFn: async (data: ExperimentFormData) => {
      // Get final variants based on cohort type
      let finalVariants = variants;
      if (selectedCohortHasGroups()) {
        const cohort = cohorts.find((c: any) => c.id.toString() === data.cohortId);
        if (cohort) {
          const totalUsers = cohort.controlCount + cohort.variantCount;
          finalVariants = [
            { 
              name: "Control", 
              allocation: totalUsers > 0 ? Math.round((cohort.controlCount / totalUsers) * 100) : 50 
            },
            { 
              name: "Variant", 
              allocation: totalUsers > 0 ? Math.round((cohort.variantCount / totalUsers) * 100) : 50 
            }
          ];
        }
      }
      
      const experimentData = {
        userId: 1, // TODO: Get from auth context
        name: data.name,
        hypothesis: data.hypothesis,
        primaryMetric: data.primaryMetric,
        secondaryMetrics: selectedSecondaryMetrics,
        duration: data.duration,
        observationWindow: data.observationWindow || 0,
        variants: finalVariants,
        audience: { 
          type: data.cohortId === "all" ? "all" : "cohort",
          cohortId: data.cohortId !== "all" ? data.cohortId : undefined,
          exposurePct: data.cohortId !== "all" ? cohortExposure[0] : 100
        },
        status: "draft",
      };
      
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experimentData),
      });
      if (!response.ok) throw new Error('Failed to create experiment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments'] });
      onOpenChange(false);
      setCurrentStep(0);
      form.reset();
      setVariants([
        { name: "Control", allocation: 50 },
        { name: "Variant B", allocation: 50 }
      ]);
      setSelectedSecondaryMetrics([]);
      onSuccess();
    },
  });

  const nextStep = async () => {
    // Check hypothesis clarity when moving from step 1 to step 2
    if (currentStep === 0) {
      const hypothesis = form.getValues('hypothesis');
      const canProceed = await checkHypothesisClarity(hypothesis);
      if (!canProceed) return; // Block if hypothesis needs improvement
    }
    
    const nextStepIndex = getNextStep(currentStep);
    setCurrentStep(Math.min(nextStepIndex, STEP_TITLES.length - 1));
  };
  const prevStep = () => {
    const prevStepIndex = getPrevStep(currentStep);
    setCurrentStep(Math.max(prevStepIndex, 0));
  };

  const addVariant = () => {
    if (variants.length < 4) {
      const equalSplit = Math.floor(100 / (variants.length + 1));
      const newVariants = variants.map(v => ({ ...v, allocation: equalSplit }));
      newVariants.push({ 
        name: `Variant ${String.fromCharCode(65 + variants.length)}`, 
        allocation: equalSplit 
      });
      setVariants(newVariants);
    }
  };

  const removeVariant = (index: number) => {
    if (variants.length > 2) {
      const newVariants = variants.filter((_, i) => i !== index);
      const equalSplit = Math.floor(100 / newVariants.length);
      setVariants(newVariants.map(v => ({ ...v, allocation: equalSplit })));
    }
  };

  const updateVariantAllocation = (index: number, allocation: number) => {
    const newVariants = [...variants];
    newVariants[index].allocation = allocation;
    
    // Ensure total is 100%
    const total = newVariants.reduce((sum, v) => sum + v.allocation, 0);
    if (total !== 100) {
      const diff = 100 - total;
      const otherIndex = index === 0 ? 1 : 0;
      newVariants[otherIndex].allocation += diff;
    }
    
    setVariants(newVariants);
  };

  const toggleSecondaryMetric = (metric: string) => {
    setSelectedSecondaryMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const onSubmit = (data: ExperimentFormData) => {
    createExperiment.mutate(data);
  };

  // Helper function to check if selected cohort has pre-assigned groups
  const selectedCohortHasGroups = () => {
    const cohortId = form.watch("cohortId");
    if (!cohortId || cohortId === "all") return false;
    const cohort = cohorts.find((c: any) => c.id.toString() === cohortId);
    return cohort?.hasGroupAssignments || false;
  };

  // Helper function to get the next step, skipping variants if groups are pre-assigned
  const getNextStep = (current: number) => {
    if (current === 1 && selectedCohortHasGroups()) {
      return 3; // Skip variants step (2) and go to metrics step (3)
    }
    return current + 1;
  };

  // Helper function to get the previous step
  const getPrevStep = (current: number) => {
    if (current === 3 && selectedCohortHasGroups()) {
      return 1; // Skip variants step (2) and go back to audience step (1)
    }
    return current - 1;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return form.getValues("name") && form.getValues("hypothesis");
      case 1:
        return true; // audience selection is optional
      case 2:
        return variants.length >= 2;
      case 3:
        return form.getValues("primaryMetric") && form.getValues("duration") > 0;
      case 4:
        return true; // review step
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[currentStep]}</DialogTitle>
          <DialogDescription>
            Design and configure a new experiment to test your hypotheses.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={currentStep} totalSteps={STEP_TITLES.length} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Step 1: Name & Objective */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experiment Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder='e.g. "Onboarding Flow Test"' 
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Choose a clear, human name.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hypothesis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hypothesis</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Hypothesis: New tutorial will lift D7 retention."
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Audience */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="cohortId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          if (value === "create-new") {
                            setShowCohortCreator(true);
                            field.onChange(undefined);
                          } else {
                            field.onChange(value);
                          }
                        }} 
                        value={field.value}
                        key={cohorts.length} // Force re-render when cohorts change
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick or create a cohort" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          {cohorts.map((cohort: any) => (
                            <SelectItem key={cohort.id} value={cohort.id.toString()}>
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <span>{cohort.name}</span>
                                  {cohort.hasGroupAssignments && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      Control: {cohort.controlCount || 0} • Variant: {cohort.variantCount || 0}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="ml-2">
                                  {cohort.size.toLocaleString()} users
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                          <Separator />
                          <SelectItem value="create-new" className="text-primary">
                            <div className="flex items-center">
                              <Plus className="h-4 w-4 mr-2" />
                              Create New Cohort…
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {cohorts.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No cohorts yet — upload a CSV to create one.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cohort Creator Inline Drawer */}
                {showCohortCreator && (
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center">
                        <FileUp className="h-4 w-4 mr-2" />
                        Create New Cohort
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="cohort-name">Cohort Name</Label>
                        <Input
                          id="cohort-name"
                          value={newCohortName}
                          onChange={(e) => setNewCohortName(e.target.value)}
                          placeholder="e.g., High Value Users"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label>User List (CSV)</Label>
                        <div className="mt-1 border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => handleCohortFileChange(e.target.files?.[0] || null)}
                            className="hidden"
                            id="csv-upload"
                          />
                          <label htmlFor="csv-upload" className="cursor-pointer">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm">Drag a CSV or click to browse.</p>
                            <p className="text-xs text-muted-foreground">One user_id per line</p>
                          </label>
                          {cohortFile && (
                            <p className="text-xs text-primary mt-2">
                              Selected: {cohortFile.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Column Mapping - shown when CSV is uploaded */}
                      {csvHeaders.length > 0 && (
                        <div className="space-y-4 border-t pt-4">
                          <h4 className="text-sm font-medium">Column Mapping</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="user-id-column">User ID Column</Label>
                              <Select value={userIdColumn} onValueChange={setUserIdColumn}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {csvHeaders.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label htmlFor="group-column">Group Assignment Column</Label>
                              <Select value={groupColumn} onValueChange={setGroupColumn}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select column (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No group assignment</SelectItem>
                                  {csvHeaders.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Group Value Mapping - shown when group column is selected */}
                          {groupColumn && groupColumn !== "none" && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="control-value">Control Group Value</Label>
                                <Input
                                  id="control-value"
                                  value={controlValue}
                                  onChange={(e) => setControlValue(e.target.value)}
                                  placeholder="e.g., control, 0, A"
                                  className="mt-1"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="variant-value">Variant Group Value</Label>
                                <Input
                                  id="variant-value"
                                  value={variantValue}
                                  onChange={(e) => setVariantValue(e.target.value)}
                                  placeholder="e.g., treatment, 1, B"
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="text-xs text-muted-foreground">
                            {groupColumn && groupColumn !== "none"
                              ? "Users will be assigned to groups based on their existing values in the selected column."
                              : "All users will be randomly assigned to control and variant groups."}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCohortCreator(false);
                            setNewCohortName("");
                            setCohortFile(null);
                            setCsvHeaders([]);
                            setUserIdColumn("");
                            setGroupColumn("");
                            setControlValue("");
                            setVariantValue("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={createCohort}
                          disabled={!newCohortName || !cohortFile}
                        >
                          Save Cohort
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sub-Cohort Exposure Slider - only show for cohorts without pre-assigned groups */}
                {(() => {
                  const selectedCohortId = form.watch("cohortId");
                  if (!selectedCohortId || selectedCohortId === "all") return null;
                  
                  const selectedCohort = cohorts.find((c: any) => c.id.toString() === selectedCohortId);
                  if (selectedCohort?.hasGroupAssignments) {
                    return (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Groups pre-assigned from CSV
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Control: {selectedCohort.controlCount} users • Variant: {selectedCohort.variantCount} users
                        </p>
                      </div>
                    );
                  }
                  
                  return null; // No exposure controls needed for uploaded cohorts
                })()}
              </div>
            )}

            {/* Step 3: Variants & Traffic - only show for cohorts without pre-assigned groups */}
            {currentStep === 2 && !selectedCohortHasGroups() && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Variants</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {variants.map((variant, index) => (
                      <VariantCard
                        key={index}
                        variant={variant}
                        index={index}
                        onUpdate={(name, allocation) => {
                          const newVariants = [...variants];
                          newVariants[index] = { name, allocation };
                          setVariants(newVariants);
                        }}
                        onDelete={variants.length > 2 ? () => removeVariant(index) : undefined}
                        canDelete={variants.length > 2 && index > 0}
                      />
                    ))}
                  </div>
                  
                  {variants.length < 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addVariant}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Variant
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">How do you want to split traffic?</Label>
                  <div className="mt-3 space-y-4">
                    <TrafficSplitVisualizer variants={variants} />
                    <div className="space-y-2">
                      {variants.map((variant, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-20 text-sm">{variant.name}</div>
                          <Slider
                            value={[variant.allocation]}
                            onValueChange={([value]) => updateVariantAllocation(index, value)}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <div className="w-12 text-right text-sm">{variant.allocation}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Metrics & Duration */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryMetric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Metric</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Search metrics…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIMARY_METRICS.map((metric) => (
                            <SelectItem key={metric.value} value={metric.value}>
                              {metric.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-sm font-medium">Secondary Metrics (optional)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SECONDARY_METRICS.map((metric) => (
                      <Badge
                        key={metric.value}
                        variant={selectedSecondaryMetrics.includes(metric.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleSecondaryMetric(metric.value)}
                      >
                        {metric.label}
                        {selectedSecondaryMetrics.includes(metric.value) && (
                          <X className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Run for</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              className="pr-12"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                              days
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observationWindow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Long-term observation
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Needed for D30 retention.</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <div className="flex items-center space-x-2">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              value={field.value || 0}
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Step 5: Review & Launch */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick recap before we fly.</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm">Name</h4>
                      <p className="text-sm text-muted-foreground">{form.getValues("name")}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">Hypothesis</h4>
                      <p className="text-sm text-muted-foreground">{form.getValues("hypothesis")}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">Groups & Assignment</h4>
                      <div className="text-sm text-muted-foreground">
                        {selectedCohortHasGroups() ? (
                          (() => {
                            const cohort = cohorts.find((c: any) => c.id === form.watch("cohortId"));
                            return (
                              <>
                                <div>Control: {cohort?.controlCount || 0} users</div>
                                <div>Variant: {cohort?.variantCount || 0} users</div>
                                <div className="text-xs text-blue-600 mt-1">Pre-assigned from CSV</div>
                              </>
                            );
                          })()
                        ) : (
                          variants.map((variant, index) => (
                            <div key={index}>{variant.name}: {variant.allocation}%</div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">Audience</h4>
                      <p className="text-sm text-muted-foreground capitalize">{form.getValues("audience")} users</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">Metrics</h4>
                      <p className="text-sm text-muted-foreground">
                        Primary: {PRIMARY_METRICS.find(m => m.value === form.getValues("primaryMetric"))?.label}
                        {selectedSecondaryMetrics.length > 0 && (
                          <span className="block">Secondary: {selectedSecondaryMetrics.length} metrics</span>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">Duration</h4>
                      <p className="text-sm text-muted-foreground">
                        {form.getValues("duration")} days
                        {form.getValues("observationWindow") > 0 && (
                          <span> + {form.getValues("observationWindow")} days observation</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 0 ? () => onOpenChange(false) : prevStep}
              >
                {currentStep === 0 ? "Cancel" : "Back"}
              </Button>
              
              {currentStep < STEP_TITLES.length - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceed()}
                >
                  Next • {STEP_TITLES[getNextStep(currentStep)].split(" · ")[1]}
                </Button>
              ) : (
                <div className="text-right">
                  <Button
                    type="submit"
                    disabled={createExperiment.isPending}
                  >
                    {createExperiment.isPending ? "Creating..." : "Start Experiment"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">You can pause anytime.</p>
                </div>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
      
      {/* Hypothesis Clarity Assist Modal */}
      <Dialog open={showHypothesisModal} onOpenChange={setShowHypothesisModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Lightbulb className="h-5 w-5 mr-2 text-primary" />
              Let's sharpen your hypothesis
            </DialogTitle>
            <DialogDescription>
              {hypothesisQuality?.missing_pieces && hypothesisQuality.missing_pieces.length > 0 ? (
                <span>
                  Missing pieces: <span className="font-medium text-destructive">
                    {hypothesisQuality.missing_pieces.join(", ")}
                  </span>. Pick a suggested version or refine manually.
                </span>
              ) : (
                "Your hypothesis looks good!"
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* Refined Hypothesis Suggestion */}
          {hypothesisQuality?.suggested_hypothesis && (
            <div className="space-y-4">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Textarea
                      value={editableHypothesis}
                      onChange={(e) => setEditableHypothesis(e.target.value)}
                      className="text-sm font-medium resize-none min-h-[80px] bg-white/50 border-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Edit your refined hypothesis..."
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          form.setValue("hypothesis", editableHypothesis);
                          setShowHypothesisModal(false);
                          toast({
                            title: "Hypothesis refined",
                            description: "Your hypothesis has been updated with the edited version."
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        ✓ Use Suggestion
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowHypothesisModal(false)}
              className="text-muted-foreground"
            >
              Keep Original
            </Button>
            <Button
              onClick={() => {
                setShowHypothesisModal(false);
                // Focus on hypothesis textarea for manual editing
                setTimeout(() => {
                  const hypothesisField = document.querySelector('[name="hypothesis"]') as HTMLTextAreaElement;
                  if (hypothesisField) {
                    hypothesisField.focus();
                    hypothesisField.setSelectionRange(hypothesisField.value.length, hypothesisField.value.length);
                  }
                }, 100);
              }}
              variant="outline"
            >
              📝 Edit Manually
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}