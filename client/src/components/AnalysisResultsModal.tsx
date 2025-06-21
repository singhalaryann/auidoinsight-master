import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp, X, Copy, Database, Code, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalysisResults {
  insightTitle: string;
  executiveSummary: string;
  liftPercent: number;
  pValue: number;
  effectSize: number;
  keyMetrics: Array<{
    group: string;
    retentionPercent: number;
    absoluteUplift: number;
    relativeUplift: number;
  }>;
  chartData: Array<{
    name: string;
    value: number;
  }>;
  businessInsights: string[];
  assumptions: string;
  sqlQuery: string;
  queryResult: any;
  pythonScript: string;
  pythonOutput: string;
  tests: Array<{
    id: string;
    label: string;
    summary: string;
    params: Record<string, string | number | Array<any>>;
    tables?: Array<{
      title: string;
      headers: string[];
      rows: Array<Array<string | number>>;
    }>;
  }>;
  analysisType: string;
  dataPoints: number;
  timeframe: string;
  cohortSize: string;
  confidence: number;
}

interface AnalysisResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  results: AnalysisResults | null;
  isLoading: boolean;
}

export default function AnalysisResultsModal({ 
  isOpen, 
  onClose, 
  question, 
  results, 
  isLoading 
}: AnalysisResultsModalProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
  };

  const formatPValue = (pValue: number) => {
    if (pValue < 1e-300) return "<1e-300";
    if (pValue < 0.001) return pValue.toExponential(2);
    return pValue.toFixed(3);
  };

  const formatCode = (code: string) => {
    // Replace literal \n with actual newlines and handle other escape sequences
    return code
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')  // Convert tabs to spaces for consistency
      .replace(/\\"/g, '"')   // Handle escaped quotes
      .trim();
  };

  const formatNumber = (n: any) =>
    typeof n === "number" ? n.toLocaleString() : n;

  // Migration helper: Convert old statisticalAnalysis format to new tests format
  const migrateStatisticalAnalysis = (results: any): AnalysisResults => {
    // If tests already exist, return as-is
    if (results.tests && Array.isArray(results.tests)) {
      return results as AnalysisResults;
    }

    // Convert old format to new format
    const tests: AnalysisResults['tests'] = [];
    
    if (results.statisticalAnalysis) {
      const stats = results.statisticalAnalysis;
      
      // Chi-Square test conversion
      if (stats.chiSquare) {
        const chiSquareTest = {
          id: "chi_square",
          label: "Chi-Square Test",
          summary: `χ² = ${stats.chiSquare.statistic}, p = ${formatPValue(stats.chiSquare.pValue)}, df = ${stats.chiSquare.degreesOfFreedom}`,
          params: {
            "χ² Statistic": stats.chiSquare.statistic,
            "P-value": stats.chiSquare.pValue,
            "Degrees of Freedom": stats.chiSquare.degreesOfFreedom
          } as Record<string, string | number | Array<any>>,
          tables: [] as Array<{
            title: string;
            headers: string[];
            rows: Array<Array<string | number>>;
          }>
        };

        // Add Expected vs Observed table if available
        if (stats.expectedVsObserved && Array.isArray(stats.expectedVsObserved)) {
          chiSquareTest.tables.push({
            title: "Expected vs Observed",
            headers: ["Group", "Observed", "Expected"],
            rows: stats.expectedVsObserved.map((row: any) => [
              row.group,
              row.observed,
              row.expected
            ])
          });
        }

        tests.push(chiSquareTest);
      }

      // Effect Size test conversion
      if (stats.effectSize) {
        tests.push({
          id: "effect_size",
          label: "Effect Size Analysis",
          summary: `Phi = ${stats.effectSize.phi} (${stats.effectSize.interpretation})`,
          params: {
            "Phi": stats.effectSize.phi,
            "Interpretation": stats.effectSize.interpretation
          }
        });
      }
    }

    // Return migrated results
    return {
      ...results,
      tests: tests.length > 0 ? tests : [{
        id: "unknown",
        label: "Statistical Analysis",
        summary: "Legacy analysis format",
        params: {}
      }]
    } as AnalysisResults;
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Analysis Results</DialogTitle>
            <DialogDescription>
              Retrieving your completed analysis...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-3 text-muted-foreground">Loading...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!results) {
    return null;
  }

  // Migrate old format to new format for backward compatibility
  const migratedResults = migrateStatisticalAnalysis(results);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Analysis Results</DialogTitle>
          <DialogDescription>Detailed analysis results for your question</DialogDescription>
        </DialogHeader>
        
        {/* ① Header Row */}
        <div className="flex items-center justify-between p-5 pb-4 border-b">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-semibold">{migratedResults.insightTitle}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString()} UTC
            </span>
            <Badge className="bg-green-100 text-green-700 border-green-200">
              Ready
            </Badge>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* ② Executive Summary Block */}
          <div className="space-y-3">
            <p className="text-base leading-relaxed">{migratedResults.executiveSummary}</p>
            <div className="flex space-x-4">
              <Badge variant="outline" className="text-xs font-bold">
                <span className="font-bold">+{migratedResults.liftPercent}%</span>
                <span className="ml-1 text-gray-500">Lift</span>
              </Badge>
              <Badge variant="outline" className="text-xs font-bold">
                <span className="font-bold">{formatPValue(migratedResults.pValue)}</span>
                <span className="ml-1 text-gray-500">p-value</span>
              </Badge>
              <Badge variant="outline" className="text-xs font-bold">
                <span className="font-bold">{migratedResults.effectSize}</span>
                <span className="ml-1 text-gray-500">Φ</span>
              </Badge>
            </div>
          </div>

          {/* ③ Key Metrics Table */}
          <div className="space-y-3">
            <h3 className="font-medium">Key Metrics</h3>
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-medium">Group</TableHead>
                  <TableHead className="text-right font-medium">Retention %</TableHead>
                  <TableHead className="text-right font-medium">Absolute ↑ (pp)</TableHead>
                  <TableHead className="text-right font-medium">Relative ↑ %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {migratedResults.keyMetrics.map((metric, index) => (
                  <TableRow key={index} className={metric.relativeUplift > 0 ? "font-bold" : ""}>
                    <TableCell>{metric.group}</TableCell>
                    <TableCell className="text-right">{metric.retentionPercent}%</TableCell>
                    <TableCell className="text-right">
                      {metric.absoluteUplift > 0 ? `+${metric.absoluteUplift}` : metric.absoluteUplift}
                    </TableCell>
                    <TableCell className="text-right">
                      {metric.relativeUplift > 0 ? `+${metric.relativeUplift}%` : `${metric.relativeUplift}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ④ Simple Impact Chart */}
          <div className="space-y-3">
            <h3 className="font-medium">Impact Visualization</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={migratedResults.chartData}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ⑤ Business Interpretation */}
          <div className="space-y-3">
            <h3 className="font-medium">Business Interpretation</h3>
            <ul className="space-y-2">
              {migratedResults.businessInsights.map((insight, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <span className="text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ⑥ Assumptions & Caveats */}
          <div className="text-sm text-gray-600 leading-tight bg-gray-50 p-3 rounded">
            {migratedResults.assumptions}
          </div>

          {/* Technical Investigation Buttons - Nested Dialog Pattern */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-1">
                  <Database className="h-3 w-3" />
                  <span>SQL Query</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>SQL Query</DialogTitle>
                  <DialogDescription>Database query used to extract the analysis data</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold">SQL Query</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(migratedResults.sqlQuery, "SQL Query")}
                      className="h-7 text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                    <pre className="whitespace-pre-wrap">{formatCode(migratedResults.sqlQuery)}</pre>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Query Result</h4>
                    <div className="bg-gray-800 text-gray-200 p-3 rounded font-mono text-sm overflow-auto max-h-64">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(migratedResults.queryResult, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-1">
                  <Code className="h-3 w-3" />
                  <span>Python Script</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Python Script</DialogTitle>
                  <DialogDescription>Statistical analysis code for calculating results</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Code className="h-4 w-4 text-green-600" />
                      <h3 className="font-semibold">Python Script</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(migratedResults.pythonScript, "Python Script")}
                      className="h-7 text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                    <pre className="whitespace-pre-wrap">{formatCode(migratedResults.pythonScript)}</pre>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Python Output</h4>
                    <div className="bg-gray-800 text-gray-200 p-3 rounded font-mono text-sm overflow-auto">
                      <pre className="whitespace-pre-wrap">{formatCode(migratedResults.pythonOutput)}</pre>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-1">
                  <Calculator className="h-3 w-3" />
                  <span>Statistical Backing</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Statistical Test Analysis</DialogTitle>
                  <DialogDescription>Detailed statistical analysis and test results</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4 text-purple-600" />
                    <h3 className="font-semibold">Statistical Analysis</h3>
                  </div>
                  <div className="space-y-3">
                    {migratedResults.tests.map(test => (
                      <div key={test.id} className="bg-white p-3 rounded border space-y-2">
                        <div className="flex items-center space-x-2">
                          <Calculator className="h-4 w-4 text-purple-600" />
                          <h5 className="text-sm font-medium">{test.label}</h5>
                        </div>
                        
                        {/* Test summary */}
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {test.summary}
                        </div>

                        {/* Key-value parameters */}
                        <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(test.params).map(([k, v]) => [
                              <div key={`${k}-label`} className="text-gray-600">{k}</div>,
                              <div key={`${k}-value`} className="font-medium">{formatNumber(v)}</div>
                          ]).flat()}
                        </div>

                        {/* Optional tables */}
                        {test.tables?.map((tbl, idx) => (
                          <div key={idx} className="pt-3">
                            <h6 className="text-xs font-semibold mb-1">{tbl.title}</h6>
                            <Table className="text-xs">
                              <TableHeader>
                                <TableRow className="bg-gray-50">
                                  {tbl.headers.map(h => <TableHead key={h} className="font-medium py-1 px-2">{h}</TableHead>)}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tbl.rows.map((row, rIdx) => (
                                  <TableRow key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <TableCell key={cIdx} className="py-1 px-2">{formatNumber(cell)}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}