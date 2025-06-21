import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, X, Copy, Code, FileBarChart, BarChart3, Trophy, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CodeViewerModal from "./CodeViewerModal";
import LaunchWizardModal from "./LaunchWizardModal";

interface ExperimentResultsModalProps {
  experimentId: number;
  experimentName: string;
  primaryMetric: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExperimentResults {
  summary: {
    outcome: string;
    winningVariant: string;
    primaryMetricDelta: number;
    primaryMetricLift: number;
    pValue: number;
    confidence: number;
    effectSize: number;
    sampleSize: number;
    testType: string;
  };
  metrics: Array<{
    group: string;
    value: number;
    absoluteChange: number;
    relativeChange: number;
    sampleSize: number;
  }>;
  chartData: {
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor: string[];
    }>;
  };
  interpretation: {
    whatHappened: string;
    soWhat: string;
    nowWhat: string[];
    headerTitle: string;
    leadInText: string;
    statDetails: {
      testType: string;
      pValue: number;
      effectSize: number;
      effectSizeLabel: string;
      sampleSize: number;
      seasonalityControls: boolean;
      testDate: string;
    };
  };
  sqlQuery: string;
  pythonScript: string;
}

const METRIC_LABELS: Record<string, string> = {
  'retention_d7': 'D7 Retention',
  'session_length': 'Session Length',
  'conversion_rate': 'Conversion Rate',
  'revenue_per_user': 'Revenue per User',
  'engagement_score': 'Engagement Score'
};

export default function ExperimentResultsModal({
  experimentId,
  experimentName,
  primaryMetric,
  open,
  onOpenChange
}: ExperimentResultsModalProps) {
  const [codeModal, setCodeModal] = useState<{
    type: 'sql' | 'python' | 'stats' | null;
    open: boolean;
  }>({ type: null, open: false });
  const [showLaunchWizard, setShowLaunchWizard] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: results, isLoading, error } = useQuery<ExperimentResults>({
    queryKey: [`/api/experiments/${experimentId}/results`],
    enabled: open && experimentId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
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



  const getMetricUnit = (metric: string) => {
    const units: Record<string, string> = {
      'retention_d7': 'pp',
      'session_length': '%',
      'conversion_rate': 'pp', 
      'revenue_per_user': '%',
      'engagement_score': '%'
    };
    return units[metric] || '%';
  };

  const formatPValue = (pValue: number) => {
    if (pValue < 0.001) return '< 0.001';
    if (pValue < 0.01) return pValue.toFixed(3);
    return pValue.toFixed(2);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading results...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !results) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load experiment results.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const metricLabel = METRIC_LABELS[primaryMetric] || primaryMetric;
  const unit = getMetricUnit(primaryMetric);
  const hasWinner = results.summary.outcome === 'winner';
  const controlVariant = results.metrics.find(m => m.group.toLowerCase().includes('control')) || results.metrics[0];

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-8">
          {/* Header */}
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <DialogTitle className="text-xl font-semibold">
                  {results.interpretation?.headerTitle || 'Loading results...'}
                  {results.summary.pValue < 0.05 && <span className="ml-2 text-green-600">✓</span>}
                </DialogTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded">
              <span>
                {formatPValue(results.summary.pValue)} (N = {Math.floor(results.summary.sampleSize / 1000)}k player-days)
              </span>
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                Ready
              </Badge>
            </div>
          </DialogHeader>

          {/* Lead-in Sentence */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {results.interpretation?.leadInText || 'Analyzing experiment results...'}
          </p>

          {/* Insight Pills */}
          <div className="flex flex-wrap gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className={`px-3 py-1 ${
                      results.summary.pValue < 0.05 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    Δ ({hasWinner ? '+' : ''}{results.summary.primaryMetricLift.toFixed(0)} {unit})
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Relative improvement over control</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Badge variant="outline" className="px-3 py-1 text-xs">
              {formatPValue(results.summary.pValue)}
            </Badge>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="px-3 py-1 text-xs">
                    δ {results.summary.effectSize.toFixed(2)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Effect size (Cohen's d) - Click for details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Key Metrics Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">N (users)</TableHead>
                    <TableHead className="text-right">{metricLabel}</TableHead>
                    <TableHead className="text-right">Δ ({unit})</TableHead>
                    <TableHead className="text-right">Δ %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.metrics.map((metric, index) => {
                    const isWinningGroup = hasWinner && metric.group === results.summary.winningVariant;
                    const isControl = metric.group === 'Control';
                    const deltaClass = !isControl && metric.absoluteChange > 0 ? 'text-green-600' : 
                                      !isControl && metric.absoluteChange < 0 ? 'text-red-600' : 
                                      'text-gray-500';
                    
                    return (
                      <TableRow key={index} className={isWinningGroup ? 'bg-blue-50/30 dark:bg-blue-950/30' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {isControl ? (
                              <span className="text-gray-600">Control – {metric.group}</span>
                            ) : (
                              <span className="text-blue-700 dark:text-blue-400">Variant – {metric.group}</span>
                            )}
                            {isWinningGroup && <span className="ml-2 text-yellow-500">🏆</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Math.floor(metric.sampleSize / 1000)}k
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {isWinningGroup ? (
                            <span className="font-bold">{metric.value.toFixed(1)}{unit}</span>
                          ) : (
                            `${metric.value.toFixed(1)}${unit}`
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${deltaClass}`}>
                          {isControl ? '–' : 
                            <>
                              <span className="font-bold">
                                {metric.absoluteChange > 0 ? '+' : ''}{metric.absoluteChange.toFixed(1)}
                              </span>
                            </>
                          }
                        </TableCell>
                        <TableCell className={`text-right font-mono ${deltaClass}`}>
                          {isControl ? '–' : 
                            <>
                              <span className="font-bold">
                                {metric.relativeChange > 0 ? '+' : ''}{metric.relativeChange.toFixed(0)}%
                              </span>
                            </>
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Impact Visualization */}
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                {/* Delta Label Above Chart */}
                {hasWinner && (
                  <div className="text-center mb-4">
                    <span className="text-lg font-bold text-green-600">
                      +{Math.abs(results.summary.primaryMetricDelta).toFixed(1)} {unit}
                    </span>
                  </div>
                )}
                
                {/* Side-by-side Bars */}
                <div className="h-40 flex items-end justify-center space-x-8">
                  {results.metrics.map((metric, index) => {
                    const isControl = metric.group === 'Control';
                    const isWinner = metric.group === results.summary.winningVariant;
                    const barHeight = (metric.value / Math.max(...results.metrics.map(m => m.value))) * 120;
                    
                    return (
                      <div key={metric.group} className="flex flex-col items-center space-y-3">
                        {/* Bar */}
                        <div 
                          className={`w-16 rounded-t-md transition-all duration-500 ${
                            isControl ? 'bg-gray-400' : 'bg-blue-500'
                          } ${isWinner ? 'ring-2 ring-blue-300' : ''}`}
                          style={{ height: `${barHeight}px` }}
                        />
                        
                        {/* Value on bar */}
                        <div className="text-center">
                          <div className={`text-sm font-bold ${isWinner ? 'text-blue-700' : 'text-gray-700'}`}>
                            {metric.value.toFixed(1)}{unit}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {isControl ? 'Control' : 'Variant'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Interpretation */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Take-away</h4>
            
            {/* What happened */}
            <div className="space-y-2">
              <p className="text-sm leading-relaxed">
                <span className="font-medium">What happened:</span> {results.interpretation?.whatHappened || 'Loading interpretation...'}
              </p>
              
              <p className="text-sm leading-relaxed">
                <span className="font-medium">So what:</span> {results.interpretation?.soWhat || 'Analyzing business impact...'}
              </p>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Now what:</p>
                <ul className="text-sm space-y-1 ml-4">
                  {results.interpretation?.nowWhat && results.interpretation.nowWhat.length > 0 ? 
                    results.interpretation.nowWhat.map((item: string, index: number) => (
                      <li key={index}>• {item}</li>
                    )) : (
                      <li>• Generating action items...</li>
                    )
                  }
                </ul>
              </div>
            </div>

            {/* Collapsible Statistical Details */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Statistical details</summary>
              <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                {results.interpretation?.statDetails ? (
                  <>
                    <p>{results.interpretation.statDetails.testType}, p {results.interpretation.statDetails.pValue < 0.001 ? '< 0.001' : `= ${results.interpretation.statDetails.pValue.toFixed(3)}`}; Cliff's δ = {results.interpretation.statDetails.effectSize.toFixed(2)} ({results.interpretation.statDetails.effectSizeLabel}). {results.interpretation.statDetails.seasonalityControls ? 'With' : 'No'} seasonality controls.</p>
                    <p className="mt-1">Sample: {Math.floor(results.interpretation.statDetails.sampleSize / 1000)}k player-days, {results.interpretation.statDetails.testDate}.</p>
                  </>
                ) : (
                  <>
                    <p>2 × 2 χ² test, p {results.summary.pValue < 0.001 ? '< 0.001' : `= ${results.summary.pValue.toFixed(3)}`}; Cliff's δ = {results.summary.effectSize.toFixed(2)} (small). No seasonality controls.</p>
                    <p className="mt-1">Sample: {Math.floor(results.summary.sampleSize / 1000)}k player-days, {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}.</p>
                  </>
                )}
              </div>
            </details>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCodeModal({ type: 'sql', open: true })}
              >
                View SQL
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCodeModal({ type: 'python', open: true })}
              >
                Python
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCodeModal({ type: 'stats', open: true })}
              >
                Stats
              </Button>
            </div>

            {/* Primary CTA */}
            <div className="flex space-x-2">
              {hasWinner ? (
                <Button variant="outline" size="sm">
                  Duplicate Test
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setLocation('/experiments?create=true');
                  }}
                >
                  Create Follow-up Experiment
                </Button>
              )}
              {hasWinner && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className={
                          connectors && Object.keys(connectors).some(key => connectors[key])
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }
                        disabled={!connectors || !Object.keys(connectors).some(key => connectors[key])}
                        onClick={() => setShowLaunchWizard(true)}
                      >
                        {connectors && Object.keys(connectors).length > 1 ? (
                          <>
                            Roll Out <ChevronDown className="h-4 w-4 ml-1" />
                          </>
                        ) : (
                          `Roll out ${results.summary.winningVariant}`
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!connectors || !Object.keys(connectors).some(key => connectors[key])
                        ? "Add RC provider in Connect tab to enable launches"
                        : "Launch winning variant via Remote Config"
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

        </DialogContent>

        {/* Code Viewer Modal */}
        <CodeViewerModal
          type={codeModal.type || 'sql'}
          open={codeModal.open}
          onOpenChange={(open) => setCodeModal(prev => ({ ...prev, open }))}
          data={{
            sqlQuery: results.sqlQuery,
            pythonScript: results.pythonScript,
            queryResult: {
              "rows": [
                {
                  "players": 187432,
                  "retained": 111834,
                  "retention_rate": 0.597,
                  "weekend_player_flag": false
                },
                {
                  "players": 145621,
                  "retained": 110361,
                  "retention_rate": 0.758,
                  "weekend_player_flag": true
                }
              ]
            },
            pythonOutput: `Chi-square statistic: 6547.23
P-value: 0.00e+00
Effect size (Phi): 0.140`,
            statsData: {
              chiSquare: "6,547.23",
              pValue: results.summary.pValue,
              degreesOfFreedom: "1"
            }
          }}
        />

        {showLaunchWizard && (
          <LaunchWizardModal
            experiment={{
              id: experimentId,
              name: experimentName,
              winningVariant: results?.summary.winningVariant
            }}
            open={showLaunchWizard}
            onOpenChange={setShowLaunchWizard}
          />
        )}
      </Dialog>
    </TooltipProvider>
  );
}