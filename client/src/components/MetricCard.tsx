import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  DollarSign, 
  Store, 
  UserPlus, 
  Activity, 
  Share2,
  BarChart3,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MetricCardProps {
  pillar: string;
  weight: number;
  data: any;
  isCompact?: boolean;
  isLoading?: boolean;
}

const pillarConfig = {
  engagement: {
    icon: Users,
    title: "Engagement",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20"
  },
  retention: {
    icon: BarChart3,
    title: "Retention",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20"
  },
  monetization: {
    icon: DollarSign,
    title: "Revenue",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
  },
  store: {
    icon: Store,
    title: "Store",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20"
  },
  ua: {
    icon: UserPlus,
    title: "Acquisition",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-900/20"
  },
  techHealth: {
    icon: Activity,
    title: "Tech Health",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20"
  },
  social: {
    icon: Share2,
    title: "Social",
    color: "text-pink-600",
    bgColor: "bg-pink-50 dark:bg-pink-900/20"
  }
};

export default function MetricCard({ pillar, weight, data, isCompact = false, isLoading = false }: MetricCardProps) {
  const config = pillarConfig[pillar as keyof typeof pillarConfig] || pillarConfig.engagement;
  const IconComponent = config.icon;

  if (isLoading) {
    return (
      <Card className="morph-animation">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-muted rounded-lg"></div>
              <div className="h-4 bg-muted rounded w-20"></div>
            </div>
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-24"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isCompact) {
    return (
      <Card className="morph-animation">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-8 h-8 ${config.bgColor} rounded-lg flex items-center justify-center`}>
              <IconComponent className={`h-4 w-4 ${config.color}`} />
            </div>
            <CardTitle className="font-semibold">{config.title}</CardTitle>
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">
            {data?.primary?.value || "N/A"}
          </div>
          <div className="text-sm text-muted-foreground">
            {data?.primary?.label || "No data"}
          </div>
          {data?.primary?.change && (
            <div className={`text-xs mt-1 flex items-center ${
              data.primary.change > 0 ? 'text-success' : 'text-error'
            }`}>
              {data.primary.change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {Math.abs(data.primary.change)}% vs last period
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="morph-animation">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 ${config.bgColor} rounded-lg flex items-center justify-center`}>
            <IconComponent className={`h-4 w-4 ${config.color}`} />
          </div>
          <CardTitle className="font-semibold">{config.title}</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {Math.round(weight * 100)}%
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {data?.metrics?.map((metric: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <div className="text-right">
                <div className="font-semibold text-foreground">{metric.value}</div>
                {metric.change && (
                  <div className={`text-xs flex items-center ${
                    metric.change > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {metric.change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {Math.abs(metric.change)}%
                  </div>
                )}
              </div>
            </div>
          )) || (
            <div className="text-center text-muted-foreground">
              No metrics available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
