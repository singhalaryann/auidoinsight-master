import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Store, 
  UserPlus, 
  Activity, 
  Share2,
  Expand,
  Share,
  Mail,
  HelpCircle
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsCardProps {
  pillar: string;
  weight: number;
  data: any;
  isPrimary?: boolean;
  isLoading?: boolean;
}

const pillarConfig = {
  engagement: {
    icon: Users,
    title: "Engagement Analysis",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20"
  },
  retention: {
    icon: BarChart3,
    title: "Retention Cohort Analysis",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20"
  },
  monetization: {
    icon: DollarSign,
    title: "Revenue Analytics",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
  },
  store: {
    icon: Store,
    title: "Store Performance",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20"
  },
  ua: {
    icon: UserPlus,
    title: "User Acquisition",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-900/20"
  },
  techHealth: {
    icon: Activity,
    title: "Technical Health",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20"
  },
  social: {
    icon: Share2,
    title: "Social Performance",
    color: "text-pink-600",
    bgColor: "bg-pink-50 dark:bg-pink-900/20"
  }
};

export default function AnalyticsCard({ pillar, weight, data, isPrimary = false, isLoading = false }: AnalyticsCardProps) {
  const { toast } = useToast();
  
  const config = pillarConfig[pillar as keyof typeof pillarConfig] || pillarConfig.engagement;
  const IconComponent = config.icon;

  const handleAction = (action: string) => {
    toast({
      title: `${action} Action`,
      description: `${action} functionality for ${config.title} will be implemented soon.`
    });
  };

  if (isLoading) {
    return (
      <Card className="morph-animation">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted rounded-lg"></div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-48"></div>
                <div className="h-3 bg-muted rounded w-64"></div>
              </div>
            </div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="morph-animation">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
              <IconComponent className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Based on recent analytics questions
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {Math.round(weight * 100)}% weight
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction("Explain")}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction("Expand")}
            >
              <Expand className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Chart Area */}
        <div className="h-64 mb-4">
          {data && data.chartData ? (
            <ResponsiveContainer width="100%" height="100%">
              {pillar === 'retention' ? (
                <AreaChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={config.color.replace('text-', '#')} 
                    fill={config.color.replace('text-', '#')}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              ) : (
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={config.color.replace('text-', '#')}
                    strokeWidth={2}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <div className="text-center">
                <IconComponent className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground font-medium">{config.title}</p>
                <p className="text-sm text-muted-foreground">Interactive chart visualization</p>
              </div>
            </div>
          )}
        </div>

        {/* Key Insight */}
        {data && data.insight && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <div className="font-semibold text-foreground mb-1">Key Insight</div>
              <div className="text-muted-foreground">{data.insight}</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center space-x-3">
          <Button
            size="sm"
            onClick={() => handleAction("Drill Down")}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Drill Down
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("Share")}
          >
            <Share className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("Add to Newsletter")}
          >
            <Mail className="h-4 w-4 mr-1" />
            Add to Newsletter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
