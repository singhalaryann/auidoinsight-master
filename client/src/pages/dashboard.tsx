import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import QuestionInput from "@/components/QuestionInput";

import IntegrationPanel from "@/components/IntegrationPanel";
import InsightsPanel from "@/components/InsightsPanel";
import MetricCard from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Mic, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, PillarWeights, AnalyticsPillar, IntentClassification, DashboardConfig } from "@shared/schema";

export default function Dashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user data
  const { data: user } = useQuery<User>({
    queryKey: ['/api/user']
  });

  // Fetch dashboard configuration
  const { data: config, isLoading: configLoading } = useQuery<DashboardConfig>({
    queryKey: ['/api/profile']
  });

  // Fetch recent questions
  const { data: questions = [] } = useQuery<any[]>({
    queryKey: ['/api/questions'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // WebSocket for real-time updates
  const { lastMessage, connectionStatus } = useWebSocket('/ws');

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        if (data.type === 'dashboard_update') {
          queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
          queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
          
          toast({
            title: "Dashboard Updated",
            description: `Adapted to focus on ${data.intent.primaryPillar} (${Math.round(data.intent.confidence * 100)}% confidence)`,
          });
        } else if (data.type === 'question_cancelled') {
          // Immediately refresh questions when one is cancelled
          queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
          
          toast({
            title: "Analysis Cancelled",
            description: "The analysis has been removed from your queue",
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, queryClient, toast]);

  // Question analysis mutation (checks if clarification is needed)
  const analyzeQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest('POST', '/api/analysis-setup', { question });
      return response.json();
    },
    onMutate: () => {
      setIsProcessing(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to analyze your question. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  // Question processing mutation (only for complete questions)
  const processQuestionMutation = useMutation({
    mutationFn: async (data: { text: string; source: string; clarifyingQuestions?: any }) => {
      const response = await apiRequest('POST', '/api/questions', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process your question. Please try again.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  const handleQuestionSubmit = async (question: string, source: string = 'web') => {
    // First, analyze if the question needs clarification
    try {
      const analysisResult = await analyzeQuestionMutation.mutateAsync(question);
      
      if (analysisResult.type === 'needs_clarification') {
        // Don't submit to insights yet - this should trigger a modal in QuestionInput
        setIsProcessing(false);
        return { needsClarification: true, clarificationQuestions: analysisResult.clarificationQuestions };
      } else {
        // Question is complete, submit directly to insights
        processQuestionMutation.mutate({ text: question, source });
        return { needsClarification: false };
      }
    } catch (error) {
      setIsProcessing(false);
      throw error;
    }
  };

  const handleDeepAnalysis = (question: string, parameters: any) => {
    // Extract clarifying questions from parameters and store them separately
    const clarifyingQuestions = parameters.clarifyingQuestions || [];
    const questionData = {
      text: question,
      source: 'deep-analysis',
      clarifyingQuestions: clarifyingQuestions,
      analysisParameters: parameters
    };
    processQuestionMutation.mutate(questionData);
  };

  // Handler for Deep Dive button from AnalysisCard
  const handleDeepDive = (question: string) => {
    // This will trigger the QuestionInput component's deep analysis flow
    // by calling the same analysis setup process
    return handleQuestionSubmit(question, 'deep-dive');
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 md:h-16">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-primary rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
                </div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg md:text-xl font-semibold text-foreground hidden sm:block">Dashboards That Listen</h1>
                  <h1 className="text-lg font-semibold text-foreground sm:hidden">Dashboard</h1>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className={`text-sm font-medium ${
                    connectionStatus === 'Connected' ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                    {connectionStatus === 'Connected' ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              {user && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground hidden md:block">{user.name}</span>
                  <Avatar className="h-7 w-7 md:h-8 md:w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        
        {/* Question Input */}
        <div className="mb-6 md:mb-8">
          <QuestionInput
            onSubmit={handleQuestionSubmit}
            onDeepAnalysis={handleDeepAnalysis}
            isProcessing={isProcessing}
            recentQuestions={questions.slice(0, 3)}
          />
        </div>



        {/* Dashboard Content */}
        <div className="space-y-4 md:space-y-6">
          {/* Insights Panel */}
          {config && (
            <InsightsPanel
              recentQuestions={questions.slice(0, 10)}
              pillarWeights={config.pillarWeights as unknown as Record<string, number>}
              onDeepDive={handleDeepDive}
            />
          )}


        </div>
      </div>
    </div>
  );
}
