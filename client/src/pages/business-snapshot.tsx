import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, AlertTriangleIcon, ZapIcon, StopCircleIcon, ChevronRightIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import InsightDetailModal from '@/components/InsightDetailModal';

interface MetricCard {
  title: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative';
  sparklineData: number[];
  description?: string;
  unit?: string;
  tags?: string[];
}

interface AIInsight {
  id: string;
  category: 'growth' | 'risk' | 'opportunity';
  message: string;
  timestamp: string;
  expanded?: boolean;
  details?: string;
}

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
    sampleSize: number;
    confidenceLevel: number;
    pValue: number;
    effectSize: number;
    methodology: string;
    assumptions: string[];
    keyMetrics: Array<{
      metric: string;
      value: string;
      change: string;
      significance: string;
    }>;
  };
}

export default function BusinessSnapshot() {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InsightDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch business snapshot data from API
  const { data: snapshotData, isLoading, error } = useQuery({
    queryKey: ['/api/business-snapshot'],
    queryFn: async () => {
      const response = await fetch('/api/business-snapshot');
      if (!response.ok) {
        throw new Error('Failed to fetch business snapshot data');
      }
      return response.json() as Promise<{ metrics: any[], insights: any[] }>;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !snapshotData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Unable to load business snapshot
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error instanceof Error ? error.message : 'Failed to fetch data'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, insights } = snapshotData;

  // Convert database metrics to UI format - extract from liveData (BigQuery results)
  const heroMetric = metrics.length > 0 ? (() => {
    const liveData = (metrics[0] as any).liveData;
    const displayConfig = metrics[0].displayConfig;
    const unit = displayConfig?.elements?.[0]?.unit || '';
    
    return {
      value: liveData?.currentValue || '$0.00',
      label: liveData?.displayName || metrics[0].name,
      delta: liveData?.deltaDisplay || '0%',
      deltaLabel: 'vs LW',
      deltaType: liveData?.deltaType || 'positive' as const,
      sparklineData: liveData?.sparklineData || [0, 0, 0, 0, 0, 0, 0],
      description: metrics[0].description || 'No description available',
      unit: unit,
      tags: metrics[0].tags || []
    };
  })() : {
    value: '$0.00',
    label: 'No Data',
    delta: '0%',
    deltaLabel: 'vs LW',
    deltaType: 'neutral' as const,
    sparklineData: [0, 0, 0, 0, 0, 0, 0],
    description: 'No description available',
    unit: '',
    tags: []
  };

  const trendCards: MetricCard[] = metrics.slice(1, 4).map(metric => {
    const liveData = (metric as any).liveData;
    const displayConfig = metric.displayConfig;
    const unit = displayConfig?.elements?.[0]?.unit || '';
    
    return {
      title: liveData?.displayName || metric.name,
      value: liveData?.currentValue || 'N/A',
      delta: liveData?.deltaDisplay || '0%',
      deltaType: liveData?.deltaType || 'positive' as const,
      sparklineData: liveData?.sparklineData || [0, 0, 0, 0, 0, 0, 0],
      description: metric.description || 'No description available',
      unit: unit,
      tags: metric.tags || []
    };
  });

  // Helper function to calculate time ago
  const getTimeAgo = (timestamp: string | Date) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMs = now.getTime() - time.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${diffInDays}d ago`;
    }
  };

  // Convert database insights to UI format - extract from contentPayload
  const uiInsights: AIInsight[] = insights.map(insight => {
    return {
      id: insight.id.toString(),
      category: insight.category as 'growth' | 'risk' | 'opportunity',
      message: insight.title,
      timestamp: getTimeAgo(insight.updatedAt || insight.createdAt),
      details: ''
    };
  });

  // Create detailed insights mapping from database data
  const detailedInsights: Record<string, InsightDetail> = {};
  
  insights.forEach(insight => {
    const content = insight.contentPayload as any;
    detailedInsights[insight.id.toString()] = {
      id: insight.id.toString(),
      category: insight.category as 'growth' | 'risk' | 'opportunity',
      message: insight.title,
      timestamp: getTimeAgo(insight.updatedAt || insight.createdAt),
      overview: content.overview,
      sqlQueries: content.sqlQueries || [],
      pythonSnippets: content.pythonSnippets || [],
      charts: content.charts || [],
      statisticalBacking: content.statisticalBacking || {
        sampleSize: 0,
        confidenceLevel: 95,
        pValue: 0.05,
        effectSize: 0,
        methodology: '',
        assumptions: [],
        keyMetrics: []
      }
    };
  });

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'growth': return <ZapIcon className="w-3 h-3" />;
      case 'risk': return <StopCircleIcon className="w-3 h-3" />;
      default: return <TrendingUpIcon className="w-3 h-3" />;
    }
  };

  const renderSparkline = (data: number[], height = 32) => {
    // Handle empty or invalid data
    if (!data || data.length === 0) {
      return (
        <svg width="80" height={height} className="text-gray-400">
          <line x1="0" y1={height / 2} x2="80" y2={height / 2} stroke="currentColor" strokeWidth="1" opacity="0.3" />
        </svg>
      );
    }

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    
    const points = data.map((value, index) => {
      const x = data.length === 1 ? 40 : (index / (data.length - 1)) * 80;
      const y = range === 0 ? height / 2 : ((max - value) / range) * height;
      return { x, y };
    });

    // Handle single data point
    if (points.length === 1) {
      return (
        <svg width="80" height={height} className="text-gray-400">
          <circle cx={points[0].x} cy={points[0].y} r="2" fill="currentColor" />
        </svg>
      );
    }

    // Create smooth curve path using quadratic bezier curves
    let pathData = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      // Calculate control point for smooth curve
      const cpX = prev.x + (curr.x - prev.x) * 0.5;
      const cpY = prev.y;
      
      pathData += ` Q ${cpX} ${cpY} ${curr.x} ${curr.y}`;
    }

    return (
      <svg width="80" height={height} className="text-gray-400">
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Trend Grid - All cards uniform */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hero metric as first card */}
        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group relative h-40">
          <CardContent className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                {heroMetric.label}
              </h3>
              <Badge 
                variant="outline"
                className={`text-xs font-medium ${
                  heroMetric.deltaType === 'positive' 
                    ? 'border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-900/20' 
                    : 'border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20'
                }`}
              >
                {heroMetric.delta}
              </Badge>
            </div>
            
            <div className="flex-1 flex items-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {heroMetric.value}
              </div>
              {heroMetric.unit && (
                <div className="text-sm text-gray-500 dark:text-gray-400 ml-2 mt-2">
                  {heroMetric.unit}
                </div>
              )}
            </div>
          </CardContent>
          
          {/* Enhanced hover overlay with tags and highlights */}
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <div className="text-center px-4 max-w-xs">
              <div className="mb-3">
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-medium mb-2 ${
                    heroMetric.deltaType === 'positive' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                  }`}
                >
                  {heroMetric.deltaType === 'positive' ? 'Trending Up' : 'Trending Down'}
                </Badge>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                {heroMetric.description}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {heroMetric.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                    {tag}
                  </Badge>
                ))}
                {heroMetric.unit && (
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                    {heroMetric.unit}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
        {trendCards.map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-all duration-200 cursor-pointer group relative h-40">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {card.title}
                </h3>
                <Badge 
                  variant="outline"
                  className={`text-xs font-medium ${
                    card.deltaType === 'positive' 
                      ? 'border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-900/20' 
                      : 'border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20'
                  }`}
                >
                  {card.delta}
                </Badge>
              </div>
              
              <div className="flex-1 flex items-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {card.value}
                </div>
                {card.unit && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 ml-2 mt-2">
                    {card.unit}
                  </div>
                )}
              </div>
            </CardContent>
            
            {/* Enhanced hover overlay with tags and highlights */}
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <div className="text-center px-4 max-w-xs">
                <div className="mb-3">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs font-medium mb-2 ${
                      card.deltaType === 'positive' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    }`}
                  >
                    {card.deltaType === 'positive' ? 'Trending Up' : 'Trending Down'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                  {card.description}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {card.tags && card.tags.length > 0 ? (
                    card.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                      No tags
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Insights Feed */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Insights</h2>
          
          {uiInsights.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No insights yet — come back tomorrow.
            </div>
          ) : (
            <div className="space-y-3">
              {uiInsights.map((insight) => (
                <div key={insight.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded ${
                        insight.category === 'growth' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        insight.category === 'risk' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {getInsightIcon(insight.category)}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {insight.message}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {insight.timestamp}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const detailedInsight = detailedInsights[insight.id];
                          if (detailedInsight) {
                            setSelectedInsight(detailedInsight);
                            setIsModalOpen(true);
                          }
                        }}
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {expandedInsight === insight.id && insight.details && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        {insight.details}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insight Detail Modal */}
      <InsightDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        insight={selectedInsight}
      />
    </div>
  );
}