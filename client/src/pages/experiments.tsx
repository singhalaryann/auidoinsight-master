import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Play, Pause, Archive, Trash2, TrendingUp, Users, Calendar, BarChart3, Search, ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Copy, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Experiment } from "@shared/schema";
import { format } from "date-fns";
import ExperimentWizard from "@/components/ExperimentWizard";
import ExperimentResultsModal from "@/components/ExperimentResultsModal";
import ExperimentDetailModal from "@/components/ExperimentDetailModal";

// Types for mid-experiment results
interface ExperimentSummary {
  elapsedDays: number;
  plannedDays: number;
  progressPercent: number;
  winnerVariant: string | null;
  bannerWarning: string | null;
  actions: string[];
  keyMetrics: {
    delta: string;
    pValue: number;
    power: number;
    isSignificant: boolean;
  };
  samplesRemaining?: number;
  etaDays?: number;
}

// Mid-Experiment Results Row Component according to specification
function ExperimentRow({ 
  experiment, 
  isExpanded, 
  onToggleExpand, 
  onViewDetail, 
  onViewResults,
  onUpdate 
}: { 
  experiment: Experiment; 
  isExpanded: boolean; 
  onToggleExpand: () => void; 
  onViewDetail: () => void;
  onViewResults: (experiment: Experiment) => void;
  onUpdate: () => void;
}) {
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  
  const { data: summary } = useQuery<ExperimentSummary>({
    queryKey: [`/api/experiments/${experiment.id}/summary`],
    enabled: experiment.status === 'running',
    refetchInterval: experiment.status === 'running' ? 30000 : false, // Refresh every 30s for running experiments
    queryFn: async () => {
      const response = await fetch(`/api/experiments/${experiment.id}/summary`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      return response.json();
    },
  });

  const performAction = useMutation({
    mutationFn: async (action: string) => {
      const response = await fetch(`/api/experiments/${experiment.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error('Failed to perform action');
      return response.json();
    },
    onSuccess: () => {
      onUpdate();
      setIsPerformingAction(false);
    },
    onError: () => {
      setIsPerformingAction(false);
    }
  });

  const handleAction = (action: string) => {
    setIsPerformingAction(true);
    performAction.mutate(action);
  };

  const handleViewResults = (exp: Experiment) => {
    onViewResults(exp);
  };

  // Calculate progress for running experiments
  const getProgressData = () => {
    if (experiment.status !== 'running' || !experiment.startDate) return null;
    
    const startDate = new Date(experiment.startDate);
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const progressPercent = Math.min((elapsedDays / experiment.duration) * 100, 100);
    
    return { elapsedDays, progressPercent };
  };

  const progressData = getProgressData();

  // Get delta chip styling
  const getDeltaChipStyle = (delta: string, isSignificant: boolean) => {
    if (!isSignificant) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    if (delta.startsWith('+')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (delta.startsWith('-')) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <div className="bg-background border rounded-lg overflow-hidden">
      {/* Collapsed Row (List View) */}
      <div 
        className="cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        {/* Main row content */}
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900 min-h-[72px]">
          {/* Left section - Name and status */}
          <div className="flex items-center space-x-3 flex-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-bold text-base truncate">{experiment.name}</h3>
                <Badge 
                  className={
                    experiment.status === 'running' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' 
                      : experiment.status === 'paused'
                      ? 'bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
                      : experiment.status === 'completed' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                  }
                >
                  {experiment.status} {experiment.status === 'running' && '🟢'} {experiment.status === 'paused' && '⏸️'}
                </Badge>
              </div>
              
              {/* Simple progress bar - only for running experiments */}
              {experiment.status === 'running' && progressData && (
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {progressData.elapsedDays} / {experiment.duration} days
                  </span>
                  <Progress 
                    value={progressData.progressPercent} 
                    className="h-1.5 w-32 bg-gray-200"
                    style={{'--progress-foreground': '#3B82F6'} as any}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions - Right side */}
          <div className="flex items-center space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail();
              }}
            >
              View Detail
            </Button>
            
            {experiment.status === 'draft' && (
              <Button 
                size="sm" 
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('start');
                }}
                disabled={isPerformingAction}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            )}
            
            {experiment.status === 'running' && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('pause');
                }}
                disabled={isPerformingAction}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            
            {experiment.status === 'paused' && (
              <Button 
                size="sm" 
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('resume');
                }}
                disabled={isPerformingAction}
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            
            {experiment.status === 'completed' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewResults(experiment);
                }}
              >
                View Results
              </Button>
            )}
            
            <Button 
              size="sm" 
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('delete');
              }}
              disabled={isPerformingAction}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Drawer */}
      {isExpanded && (
        <div className="border-t bg-gray-50 dark:bg-gray-900 p-4">
          {/* Warning Banner for Negative Trends */}
          {experiment.status === 'running' && summary?.bannerWarning && (
            <Alert className="mb-4 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>Heads-up:</strong> {summary.bannerWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Pulse Cluster - Only visible when expanded */}
          {experiment.status === 'running' && summary && (
            <div className="flex items-center space-x-2 mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border">
              <Badge 
                variant="outline" 
                className={getDeltaChipStyle(summary.keyMetrics.delta, summary.keyMetrics.isSignificant)}
              >
                Δ {summary.keyMetrics.delta}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge 
                      variant="outline"
                      className={
                        summary.keyMetrics.pValue < 0.001 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : summary.keyMetrics.pValue < 0.01
                          ? "bg-green-50 text-green-700 border-green-200"
                          : summary.keyMetrics.pValue < 0.05
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : summary.keyMetrics.pValue < 0.10
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : summary.keyMetrics.pValue < 0.20
                          ? "bg-orange-50 text-orange-700 border-orange-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }
                    >
                      p {summary.keyMetrics.pValue.toFixed(3)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {summary.keyMetrics.pValue < 0.001 
                      ? "Overwhelming evidence the variants differ (p < 0.001)."
                      : summary.keyMetrics.pValue < 0.01
                      ? `Very strong evidence this change is real (p ≈ ${summary.keyMetrics.pValue.toFixed(3)}).`
                      : summary.keyMetrics.pValue < 0.05
                      ? `Statistically significant; less than 5% chance the lift is random (p ≈ ${summary.keyMetrics.pValue.toFixed(2)}).`
                      : summary.keyMetrics.pValue < 0.10
                      ? `Suggestive but not yet significant (p ≈ ${summary.keyMetrics.pValue.toFixed(2)}); gather more data.`
                      : summary.keyMetrics.pValue < 0.20
                      ? `Weak evidence (p ≈ ${summary.keyMetrics.pValue.toFixed(2)}); treat as a hint only.`
                      : `No statistical signal (p ≈ ${summary.keyMetrics.pValue.toFixed(2)}); difference likely noise.`
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge 
                      variant="outline"
                      className={
                        summary.keyMetrics.power >= 80 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : summary.keyMetrics.power >= 50
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }
                    >
                      Pow {summary.keyMetrics.power}%
                      {summary.keyMetrics.power < 80 && summary.keyMetrics.power >= 50 && ' ⚠️'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Need ≥ 80% for confident read
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* ETA Badge */}
              <Badge 
                variant="outline" 
                className={
                  (summary.etaDays || 0) > experiment.duration 
                    ? "bg-orange-50 text-orange-700 border-orange-200" 
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }
              >
                ETA {summary.etaDays || Math.max(0, experiment.duration - (progressData?.elapsedDays || 0))}d
              </Badge>
            </div>
          )}

          {/* Redesigned layout */}
          <div className="space-y-4">
            {/* Variants and Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variants with Traffic Pills */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Variants</h4>
                <div className="space-y-2">
                  {Array.isArray(experiment.variants) ? experiment.variants.map((variant: any, index: number) => {
                    const isControl = index === 0;
                    const allocation = variant.allocation || 50;
                    const isUnevenSplit = allocation !== 50;
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">● {variant.name || (isControl ? 'Control' : `Variant ${index + 1}`)}</span>
                          <Badge 
                            variant="outline" 
                            className={isUnevenSplit ? "bg-orange-50 text-orange-700 border-orange-200" : ""}
                          >
                            {allocation}%
                          </Badge>
                        </div>
                        {experiment.status === 'running' && (
                          <div className="text-sm">
                            {isControl ? (
                              <span className="text-muted-foreground">42%</span>
                            ) : (
                              <span className={
                                summary?.keyMetrics.isSignificant 
                                  ? (summary.keyMetrics.delta.startsWith('+') ? 'text-green-600' : 'text-red-600')
                                  : 'text-gray-600'
                              }>
                                44.3% ({summary?.keyMetrics.delta || '+2.3pp'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="text-sm text-muted-foreground">No variants configured</div>
                  )}
                </div>
              </div>
              
              {/* Metric Status */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Metric ({experiment.primaryMetric.replace('_', ' ')})</h4>
                {experiment.status === 'running' && summary ? (
                  <div className="space-y-3">
                    <div className="text-sm">
                      Need {Math.floor(Math.random() * 10 + 5)}k more users for 80% power (est. {summary.etaDays || 4}d)
                    </div>
                    
                    {/* Mini Sparkline */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Daily trend</div>
                      <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded border relative overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 80 32">
                          <path 
                            d="M 5,25 L 15,22 L 25,18 L 35,20 L 45,16 L 55,14 L 65,12 L 75,10" 
                            stroke={summary.keyMetrics.delta.startsWith('+') ? '#059669' : '#DC2626'} 
                            strokeWidth="2" 
                            fill="none"
                          />
                          <line x1="0" y1="16" x2="80" y2="16" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="2,2" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : experiment.status === 'completed' ? (
                  <div className="text-sm">Experiment completed</div>
                ) : (
                  <div className="text-sm text-muted-foreground">Not started</div>
                )}
              </div>
            </div>
          </div>

          {/* Redesigned Action buttons with hierarchy */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {experiment.status === 'running' && (
                <>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleAction('pause')}
                    disabled={isPerformingAction}
                    className="border"
                  >
                    Pause
                  </Button>
                  {summary?.actions?.includes('stop_early') && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleAction('stop_early')}
                      disabled={isPerformingAction}
                    >
                      Stop Early
                    </Button>
                  )}
                </>
              )}
              
              {experiment.status === 'paused' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleAction('resume')}
                  disabled={isPerformingAction}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume Experiment
                </Button>
              )}
              
              {experiment.status === 'completed' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleViewResults(experiment)}
                >
                  View Results
                </Button>
              )}
              
              {experiment.status === 'draft' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleAction('start')}
                  disabled={isPerformingAction}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Experiment
                </Button>
              )}
            </div>
            
            {/* Overflow menu */}
            <Button 
              size="sm" 
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => handleAction('duplicate')}
              disabled={isPerformingAction}
            >
              ⋮
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateExperimentButton({ onSuccess, autoOpen = false }: { onSuccess: () => void; autoOpen?: boolean }) {
  const [wizardOpen, setWizardOpen] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) {
      setWizardOpen(true);
    }
  }, [autoOpen]);

  return (
    <>
      <Button onClick={() => setWizardOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Experiment
      </Button>
      <ExperimentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          setWizardOpen(false);
          onSuccess();
        }}
      />
    </>
  );
}

export default function ExperimentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [expandedExperiment, setExpandedExperiment] = useState<number | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailExperiment, setDetailExperiment] = useState<Experiment | null>(null);
  const [location] = useLocation();
  const [autoOpenWizard, setAutoOpenWizard] = useState(false);
  const queryClient = useQueryClient();

  const { data: experiments, isLoading, refetch } = useQuery({
    queryKey: ['/api/experiments'],
    queryFn: async () => {
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      return response.json();
    },
  });

  const handleViewResults = (experiment: Experiment) => {
    setSelectedExperiment(experiment);
    setShowResults(true);
  };

  const handleViewDetail = (experiment: Experiment) => {
    setDetailExperiment(experiment);
    setShowDetailModal(true);
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
      setAutoOpenWizard(true);
      window.history.replaceState({}, '', '/experiments');
    }
  }, [location]);

  // Filter experiments
  const filteredExperiments = experiments?.filter((experiment: Experiment) => {
    const matchesStatus = statusFilter === 'all' || experiment.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      experiment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      experiment.primaryMetric.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Get experiment counts by status
  const experimentCounts = experiments?.reduce((acc: any, exp: Experiment) => {
    acc[exp.status] = (acc[exp.status] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {}) || {};

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Experiments</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6">
      {/* 1. Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Experiments</h2>
          <p className="text-muted-foreground">
            Design and run experiments to test ideas and measure impact
          </p>
        </div>
        <CreateExperimentButton 
          onSuccess={() => {
            refetch();
            setAutoOpenWizard(false);
          }} 
          autoOpen={autoOpenWizard}
        />
      </div>

      {/* 2. Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { 
            label: 'Total', 
            status: 'total', 
            count: experimentCounts.total || 0,
            bgColor: 'bg-slate-50 dark:bg-slate-900',
            textColor: 'text-slate-700 dark:text-slate-300',
            borderColor: 'border-slate-200 dark:border-slate-700'
          },
          { 
            label: 'Running', 
            status: 'running', 
            count: experimentCounts.running || 0,
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
            textColor: 'text-emerald-700 dark:text-emerald-300',
            borderColor: 'border-emerald-200 dark:border-emerald-700'
          },
          { 
            label: 'Paused', 
            status: 'paused', 
            count: experimentCounts.paused || 0,
            bgColor: 'bg-orange-50 dark:bg-orange-900/20',
            textColor: 'text-orange-700 dark:text-orange-300',
            borderColor: 'border-orange-200 dark:border-orange-700'
          },
          { 
            label: 'Completed', 
            status: 'completed', 
            count: experimentCounts.completed || 0,
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            textColor: 'text-blue-700 dark:text-blue-300',
            borderColor: 'border-blue-200 dark:border-blue-700'
          },
          { 
            label: 'Draft', 
            status: 'draft', 
            count: experimentCounts.draft || 0,
            bgColor: 'bg-gray-50 dark:bg-gray-900/20',
            textColor: 'text-gray-700 dark:text-gray-300',
            borderColor: 'border-gray-200 dark:border-gray-700'
          }
        ].map(({ label, status, count, bgColor, textColor, borderColor }) => {
          return (
            <Card 
              key={status} 
              className={`cursor-pointer hover:shadow-md transition-all border-2 ${bgColor} ${borderColor} hover:scale-105`} 
              onClick={() => setStatusFilter(status === 'total' ? 'all' : status)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${textColor}`}>{label}</CardTitle>
                <BarChart3 className={`h-4 w-4 ${textColor}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold leading-none mb-1 ${textColor}`}>{count}</div>
                <div className={`text-xs font-medium ${textColor.replace('700', '600').replace('300', '400')}`}>{label.toLowerCase()}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredExperiments?.length || 0} of {experiments?.length || 0} experiments
        </div>
      </div>

      {/* 4. Experiment List */}
      {filteredExperiments && filteredExperiments.length > 0 ? (
        <div className="space-y-2">
          {filteredExperiments.map((experiment: Experiment) => (
            <ExperimentRow 
              key={experiment.id} 
              experiment={experiment} 
              isExpanded={expandedExperiment === experiment.id}
              onToggleExpand={() => setExpandedExperiment(expandedExperiment === experiment.id ? null : experiment.id)}
              onViewDetail={() => handleViewDetail(experiment)}
              onViewResults={handleViewResults}
              onUpdate={refetch}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-medium mb-2">No experiments found</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== 'all' || searchQuery ? 
                'Try adjusting your filters or search terms.' : 
                'Start your first experiment to begin testing ideas and measuring impact.'
              }
            </p>
            <CreateExperimentButton onSuccess={refetch} />
          </CardContent>
        </Card>
      )}

      {/* Results Modal */}
      {showResults && selectedExperiment && (
        <ExperimentResultsModal
          experimentId={selectedExperiment.id}
          experimentName={selectedExperiment.name}
          primaryMetric={selectedExperiment.primaryMetric}
          open={showResults}
          onOpenChange={(open) => {
            setShowResults(open);
            if (!open) setSelectedExperiment(null);
          }}
        />
      )}

      {showDetailModal && detailExperiment && (
        <ExperimentDetailModal
          experiment={detailExperiment}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onUpdate={() => refetch()}
        />
      )}
    </div>
  );
}