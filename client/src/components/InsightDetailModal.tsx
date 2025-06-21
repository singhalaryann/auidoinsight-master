import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, LineChart, Line, Legend, Cell } from "recharts";
import { TrendingUp, X, Copy, Database, Code, Calculator, ZapIcon, StopCircleIcon, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface SqlQuery {
  id: string;
  description: string;
  query: string;
  result?: {
    headers: string[];
    rows: (string | number)[][];
  };
}

interface PythonSnippet {
  id: string;
  description: string;
  code: string;
  result?: string;
}

interface ChartData {
  id: string;
  title: string;
  description: string;
  type: 'bar' | 'area' | 'line';
  data: any[];
  config: {
    xKey: string;
    yKey: string;
    color: string;
  };
}

interface InsightDetail {
  id: string;
  category: 'growth' | 'risk' | 'opportunity';
  message: string;
  timestamp: string;
  overview: {
    title: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      details: string;
    }>;
  };
  sqlQueries: SqlQuery[];
  pythonSnippets: PythonSnippet[];
  charts?: any[];
  statisticalBacking: {
    sampleSize?: number;
    confidenceLevel?: number;
    pValue?: number;
    effectSize?: number;
    methodology: string;
    assumptions: string[];
    keyMetrics: Array<{
      metric: string;
      value: string;
      change: string;
      significance: string;
    }>;
    interactionCoefficient?: number;
  };
}

interface InsightDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: InsightDetail | null;
}

export default function InsightDetailModal({ isOpen, onClose, insight }: InsightDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'sql' | 'python' | 'stats' | 'charts'>('overview');
  const [expandedQueries, setExpandedQueries] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const toggleQueryExpansion = (chartId: string) => {
    setExpandedQueries(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
  };



  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
  };

  const formatCode = (code: string) => {
    return code
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"')
      .trim();
  };

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'growth': return <ZapIcon className="w-4 h-4" />;
      case 'risk': return <StopCircleIcon className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'growth': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'risk': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  if (!insight) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded ${getCategoryColor(insight.category)}`}>
              {getInsightIcon(insight.category)}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {insight.message}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                Generated {insight.timestamp}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'sql', label: 'SQL Queries', icon: Database },
            { id: 'python', label: 'Python Scripts', icon: Code },
            { id: 'charts', label: 'Charts', icon: BarChart3 },
            { id: 'stats', label: 'Statistical Backing', icon: Calculator }
          ].map(tab => (
            <button
              key={tab.id}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{insight.overview.title}</h3>
                <div className="space-y-6">
                  {insight.overview.steps.map((step, index) => (
                    <div key={index} className="border-l-4 border-blue-200 dark:border-blue-800 pl-6">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold">
                          {step.stepNumber}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {step.title}
                        </h4>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {step.description}
                      </p>
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                        {step.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">SQL Queries</h3>
              {insight.sqlQueries.map((sqlQuery, index) => (
                <div key={sqlQuery.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        Query {index + 1}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {sqlQuery.description}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(sqlQuery.query, `SQL Query ${index + 1}`)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                    <code>{formatCode(sqlQuery.query)}</code>
                  </pre>
                  {sqlQuery.result && (
                    <div>
                      <h5 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Result Sample:</h5>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {sqlQuery.result.headers.map((header, idx) => (
                                <TableHead key={idx}>{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sqlQuery.result.rows.slice(0, 5).map((row, rowIdx) => (
                              <TableRow key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                  <TableCell key={cellIdx}>{cell}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Python Scripts</h3>
              {insight.pythonSnippets.map((snippet, index) => (
                <div key={snippet.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        Script {index + 1}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {snippet.description}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(snippet.code, `Python Script ${index + 1}`)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                    <code>{formatCode(snippet.code)}</code>
                  </pre>
                  {snippet.result && (
                    <div>
                      <h5 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Output:</h5>
                      <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm text-gray-700 dark:text-gray-300">
                        {snippet.result}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Charts & Visualizations</h3>

              {insight.charts && insight.charts.length > 0 ? (
                <div className="space-y-6">
                  {insight.charts.map((chart: any, index: number) => (
                    <div key={chart.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {chart.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {chart.description}
                        </p>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          {chart.type === 'bar' ? (
                            <BarChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis 
                                tickFormatter={(value) => 
                                  chart.config.yKey === 'mean_spend' || chart.config.yKey === 'retention_rate'
                                    ? chart.config.yKey === 'mean_spend' 
                                      ? `£${value.toFixed(2)}`
                                      : `${value.toFixed(1)}%`
                                    : value.toString()
                                }
                              />
                              <Bar dataKey={chart.config.yKey} fill={chart.config.color} />
                            </BarChart>
                          ) : chart.type === 'colored_bar' ? (
                            <BarChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis />
                              <Legend 
                                payload={Object.keys(chart.config.colors).map((key) => ({
                                  value: key,
                                  type: 'rect',
                                  color: chart.config.colors[key]
                                }))}
                              />
                              <Bar dataKey={chart.config.yKey}>
                                {chart.data.map((entry: any, index: number) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={chart.config.colors[entry[chart.config.colorKey]] || '#8884d8'} 
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : chart.type === 'stacked_bar' ? (
                            <BarChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis 
                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                              />
                              <Legend />
                              {chart.config.stackKeys.map((stack: any, idx: number) => (
                                <Bar 
                                  key={idx}
                                  dataKey={stack.dataKey} 
                                  stackId="retention"
                                  fill={stack.fill}
                                  name={stack.name}
                                />
                              ))}
                            </BarChart>
                          ) : chart.type === 'area' ? (
                            <AreaChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis />
                              <Area 
                                type="monotone" 
                                dataKey={chart.config.yKey} 
                                stroke={chart.config.color} 
                                fill={chart.config.color}
                                fillOpacity={0.6}
                              />
                            </AreaChart>
                          ) : chart.config && chart.config.lines ? (
                            <LineChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis />
                              <Legend />
                              {chart.config.lines.map((line: any, idx: number) => (
                                <Line 
                                  key={idx}
                                  type="monotone" 
                                  dataKey={line.dataKey} 
                                  stroke={line.color} 
                                  strokeWidth={2}
                                  name={line.name}
                                />
                              ))}
                            </LineChart>
                          ) : (
                            <LineChart data={chart.data}>
                              <XAxis dataKey={chart.config.xKey} />
                              <YAxis />
                              <Line 
                                type="monotone" 
                                dataKey={chart.config.yKey} 
                                stroke={chart.config.color} 
                                strokeWidth={2}
                              />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Show Query Button and Collapsible Query Section */}
                      {chart.query && (
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleQueryExpansion(chart.id)}
                            className="mb-3"
                          >
                            <Database className="w-4 h-4 mr-2" />
                            {expandedQueries[chart.id] ? 'Hide Query' : 'Show Query'}
                          </Button>
                          
                          {expandedQueries[chart.id] && (
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-medium text-gray-900 dark:text-gray-100">SQL Query</h5>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => copyToClipboard(chart.query, 'SQL Query')}
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy
                                </Button>
                              </div>
                              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                                <code className="text-gray-800 dark:text-gray-200">{chart.query}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No chart data available for this insight.
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Statistical Analysis</h3>
                
                {/* Statistical Summary - Bullet Points */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Key Statistical Measures</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {insight.statisticalBacking.sampleSize && (
                      <li>• <strong>Sample Size:</strong> {insight.statisticalBacking.sampleSize.toLocaleString()} player-day observations</li>
                    )}
                    {insight.statisticalBacking.confidenceLevel && (
                      <li>• <strong>Confidence Level:</strong> {insight.statisticalBacking.confidenceLevel}%</li>
                    )}
                    {insight.statisticalBacking.pValue !== undefined && insight.statisticalBacking.pValue !== null && (
                      <li>• <strong>P-Value:</strong> {insight.statisticalBacking.pValue < 0.001 ? '< 0.001' : insight.statisticalBacking.pValue.toFixed(4)}</li>
                    )}
                    {insight.statisticalBacking.effectSize && (
                      <li>• <strong>Effect Size:</strong> {insight.statisticalBacking.effectSize.toFixed(3)}</li>
                    )}
                    {insight.statisticalBacking.interactionCoefficient && (
                      <li>• <strong>Interaction Coefficient:</strong> {insight.statisticalBacking.interactionCoefficient}</li>
                    )}
                  </ul>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-3">Key Metrics</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Significance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insight.statisticalBacking.keyMetrics.map((metric, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{metric.metric}</TableCell>
                          <TableCell>{metric.value}</TableCell>
                          <TableCell>{metric.change}</TableCell>
                          <TableCell>{metric.significance}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-3">Methodology</h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {insight.statisticalBacking.methodology}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Assumptions</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                    {insight.statisticalBacking.assumptions.map((assumption, index) => (
                      <li key={index}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}