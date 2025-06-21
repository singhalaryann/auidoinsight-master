import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Quote, Target, Clock } from "lucide-react";

interface Question {
  id: number;
  text: string;
  timestamp: string;
}

interface IntentClassification {
  pillars: string[];
  confidence: number;
  primaryPillar: string;
}

interface ExplainabilityPanelProps {
  recentQuestions: Question[];
  pillarWeights: Record<string, number>;
  currentIntent: IntentClassification | null;
}

export default function ExplainabilityPanel({ 
  recentQuestions, 
  pillarWeights, 
  currentIntent 
}: ExplainabilityPanelProps) {
  
  const topPillars = Object.entries(pillarWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Lightbulb className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg">Why You're Seeing This Dashboard</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Recent Questions */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center">
              <Quote className="h-4 w-4 mr-2" />
              Recent Questions
            </h4>
            {recentQuestions.length > 0 ? (
              recentQuestions.map((question) => (
                <div key={question.id} className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
                  <Quote className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground break-words">{question.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(question.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground italic">
                No recent questions yet. Start asking to personalize your dashboard!
              </div>
            )}
          </div>
          
          {/* Current Focus */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Current Focus
            </h4>
            <div className="space-y-2">
              {topPillars.map(([pillar, weight]) => (
                <div key={pillar} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                  <span className="text-sm font-medium text-primary capitalize">
                    {pillar}
                  </span>
                  <Badge variant="secondary">
                    {Math.round(weight * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
            
            {currentIntent && (
              <div className="mt-4 p-3 bg-success/5 rounded-lg">
                <div className="text-sm">
                  <div className="font-medium text-success mb-1">Latest Intent</div>
                  <div className="text-muted-foreground">
                    {currentIntent.primaryPillar} • {Math.round(currentIntent.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Adaptation Timeline */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Adaptation Timeline
            </h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-foreground">Dashboard reordered</span>
                <span className="text-muted-foreground ml-auto">1m ago</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-foreground">Charts prioritized</span>
                <span className="text-muted-foreground ml-auto">2m ago</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                <span className="text-foreground">Intent classified</span>
                <span className="text-muted-foreground ml-auto">2m ago</span>
              </div>
              
              {/* Exponential Decay Explanation */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground">
                  <strong>How it works:</strong> Your questions shape the dashboard with exponential decay. 
                  Recent questions have more influence, with weights gradually fading over 14 days.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
