import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, Check, Database, Code, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeViewerModalProps {
  type: 'sql' | 'python' | 'stats';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    sqlQuery?: string;
    pythonScript?: string;
    queryResult?: any;
    pythonOutput?: string;
    statsData?: any;
  };
}

export default function CodeViewerModal({ type, open, onOpenChange, data }: CodeViewerModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, isResult = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isResult) {
        setCopiedResult(true);
        setTimeout(() => setCopiedResult(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
      toast({
        description: "Copied to clipboard",
      });
    } catch (err) {
      toast({
        description: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const getModalConfig = () => {
    switch (type) {
      case 'sql':
        return {
          title: 'SQL Query',
          description: 'Database query used to extract the analysis data',
          icon: <Database className="h-5 w-5" />,
          code: data.sqlQuery || '',
          result: data.queryResult,
          resultTitle: 'Query Result'
        };
      case 'python':
        return {
          title: 'Python Script',
          description: 'Statistical analysis code for calculating results',
          icon: <Code className="h-5 w-5" />,
          code: data.pythonScript || '',
          result: data.pythonOutput,
          resultTitle: 'Python Output'
        };
      case 'stats':
        return {
          title: 'Statistical Test Analysis',
          description: 'Detailed statistical analysis and test results',
          icon: <BarChart3 className="h-5 w-5" />,
          code: null,
          result: null,
          resultTitle: null
        };
      default:
        return { title: '', description: '', icon: null, code: '', result: null, resultTitle: null };
    }
  };

  const config = getModalConfig();

  const renderStatsContent = () => {
    if (!data.statsData) return null;

    return (
      <div className="space-y-6">
        {/* Chi-Square Test Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Chi-Square Test</h3>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              χ² = {data.statsData.chiSquare || '6547.23'}, p &lt; 1e-300, df = 1
            </p>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">P-value</span>
                <div className="text-lg font-mono">{data.statsData.pValue || '0'}</div>
              </div>
              <div>
                <span className="font-medium">χ² Statistic</span>
                <div className="text-lg font-mono">{data.statsData.chiSquare || '6,547.23'}</div>
              </div>
              <div>
                <span className="font-medium">Degrees of Freedom</span>
                <div className="text-lg font-mono">{data.statsData.degreesOfFreedom || '1'}</div>
              </div>
            </div>
          </div>

          {/* Expected vs Observed Table */}
          <div className="space-y-3">
            <h4 className="font-medium">Expected vs Observed</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="text-left p-3 font-medium">Group</th>
                    <th className="text-right p-3 font-medium">Observed</th>
                    <th className="text-right p-3 font-medium">Expected</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3">Weekend Retained</td>
                    <td className="p-3 text-right font-mono">110,361</td>
                    <td className="p-3 text-right font-mono">103,284</td>
                  </tr>
                  <tr>
                    <td className="p-3">Weekend Not Retained</td>
                    <td className="p-3 text-right font-mono">35,260</td>
                    <td className="p-3 text-right font-mono">42,337</td>
                  </tr>
                  <tr>
                    <td className="p-3">Weekday Retained</td>
                    <td className="p-3 text-right font-mono">111,834</td>
                    <td className="p-3 text-right font-mono">118,911</td>
                  </tr>
                  <tr>
                    <td className="p-3">Weekday Not Retained</td>
                    <td className="p-3 text-right font-mono">75,598</td>
                    <td className="p-3 text-right font-mono">68,521</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Effect Size Analysis */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Effect Size Analysis</h3>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              Phi = 0.140 (Small to medium effect)
            </p>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Phi</span>
                <div className="text-lg font-mono">0.14</div>
              </div>
              <div>
                <span className="font-medium">Interpretation</span>
                <div className="text-sm">Small to medium effect</div>
              </div>
              <div>
                <span className="font-medium">Cohen's Guidelines</span>
                <div className="text-xs text-muted-foreground">0.1 = small, 0.3 = medium, 0.5 = large</div>
              </div>
            </div>
          </div>
        </div>

        {/* 95% Confidence Interval */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">95% Confidence Interval</h3>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              Difference: 16.1pp [15.8pp, 16.4pp]
            </p>
            
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Lower Bound</span>
                <div className="text-lg font-mono">15.8pp</div>
              </div>
              <div>
                <span className="font-medium">Upper Bound</span>
                <div className="text-lg font-mono">16.4pp</div>
              </div>
              <div>
                <span className="font-medium">Point Estimate</span>
                <div className="text-lg font-mono">16.1pp</div>
              </div>
              <div>
                <span className="font-medium">Confidence Level</span>
                <div className="text-lg font-mono">95%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {config.icon}
              <div>
                <DialogTitle className="text-xl">{config.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {type === 'stats' ? (
            renderStatsContent()
          ) : (
            <>
              {/* Code Section */}
              {config.code && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {type === 'sql' ? (
                        <Database className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Code className="h-4 w-4 text-green-600" />
                      )}
                      <span className="font-medium">{config.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.code)}
                      className="flex items-center space-x-1"
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>Copy</span>
                    </Button>
                  </div>
                  
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {config.code}
                    </pre>
                  </div>
                </div>
              )}

              {/* Result Section */}
              {config.result && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{config.resultTitle}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        typeof config.result === 'string' 
                          ? config.result 
                          : JSON.stringify(config.result, null, 2)
                      )}
                      className="flex items-center space-x-1"
                    >
                      {copiedResult ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>Copy</span>
                    </Button>
                  </div>
                  
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {typeof config.result === 'string' 
                        ? config.result 
                        : JSON.stringify(config.result, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}