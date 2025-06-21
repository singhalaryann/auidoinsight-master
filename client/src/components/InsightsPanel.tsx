import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import AnalysisCard from "./AnalysisCard";
import AnalysisBriefModal from "./AnalysisBriefModal";
import AnalysisResultsModal from "./AnalysisResultsModal";

interface Question {
  id: number;
  text: string;
  source: string;
  timestamp: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  result?: any;
}

interface InsightsPanelProps {
  recentQuestions: Question[];
  pillarWeights: Record<string, number>;
  onDeepDive?: (question: string) => void;
}

interface AnalysisBrief {
  heading: string;
  description: string;
  hypothesis: string;
  statisticalTest: string;
  userCohort: string;
  timeFrame: string;
}

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
  pythonScript: string;
  pythonOutput: string;
  analysisType: string;
  dataPoints: number;
  timeframe: string;
  cohortSize: string;
  confidence: number;
}

export default function InsightsPanel({ recentQuestions, pillarWeights, onDeepDive }: InsightsPanelProps) {
  const activeQuestions = recentQuestions.filter(q => q.status === 'queued' || q.status === 'ready');
  const [briefModal, setBriefModal] = useState<{
    isOpen: boolean;
    brief: AnalysisBrief | null;
    question: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    brief: null,
    question: '',
    isLoading: false
  });

  const [resultsModal, setResultsModal] = useState<{
    isOpen: boolean;
    results: AnalysisResults | null;
    question: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    results: null,
    question: '',
    isLoading: false
  });

  const handleCancelAnalysis = async (questionId: number) => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('Analysis cancelled successfully');
      } else {
        console.error('Failed to cancel analysis');
      }
    } catch (error) {
      console.error('Error cancelling analysis:', error);
    }
  };

  const handleGenerateBrief = async (questionId: number) => {
    const question = recentQuestions.find(q => q.id === questionId);
    if (!question) return;

    // If the question is ready, show results instead of generating brief
    if (question.status === 'ready') {
      try {
        // The API now returns structured result objects directly
        const results = question.result || {};
        
        setResultsModal({
          isOpen: true,
          results,
          question: question.text,
          isLoading: false
        });
      } catch (error) {
        console.error('Error handling analysis results:', error, 'Raw result:', question.result);
      }
      return;
    }

    // For queued questions, generate analysis brief
    setBriefModal({
      isOpen: true,
      brief: null,
      question: question.text,
      isLoading: true
    });

    try {
      const response = await fetch('/api/analysis-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          clarifyingQuestions: [],
          analysisSetup: { type: 'queued', pillars: ['engagement'] }
        })
      });
      
      if (response.ok) {
        const brief = await response.json();
        setBriefModal(prev => ({
          ...prev,
          brief,
          isLoading: false
        }));
      } else {
        console.error('Failed to generate analysis brief');
        setBriefModal(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error generating analysis brief:', error);
      setBriefModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const closeBriefModal = () => {
    setBriefModal({
      isOpen: false,
      brief: null,
      question: '',
      isLoading: false
    });
  };

  const closeResultsModal = () => {
    setResultsModal({
      isOpen: false,
      results: null,
      question: '',
      isLoading: false
    });
  };

  if (activeQuestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Personalized Insights</span>
          </CardTitle>
          <CardDescription>
            AI-generated insights from your recent questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ask questions to generate analysis insights</p>
            <p className="text-sm">Your queued analyses will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Instant Insights</span>
        </CardTitle>
        <CardDescription>
          Answers generated from your last {recentQuestions.length} questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeQuestions.map((question: any) => (
          <AnalysisCard
            key={question.id}
            question={question.text}
            questionId={question.id}
            status={question.status as 'queued' | 'waiting-for-answers' | 'ready'}
            clarifyingQuestions={question.clarifyingQuestions || []}
            onCancel={() => handleCancelAnalysis(question.id)}
            onGenerateBrief={() => handleGenerateBrief(question.id)}
            onDeepDive={() => onDeepDive?.(question.text)}
          />
        ))}
      </CardContent>

      {/* Analysis Brief Modal */}
      <AnalysisBriefModal
        isOpen={briefModal.isOpen}
        onClose={closeBriefModal}
        brief={briefModal.brief}
        question={briefModal.question}
        isLoading={briefModal.isLoading}
      />

      {/* Analysis Results Modal */}
      <AnalysisResultsModal
        isOpen={resultsModal.isOpen}
        onClose={closeResultsModal}
        results={resultsModal.results}
        question={resultsModal.question}
        isLoading={resultsModal.isLoading}
      />
    </Card>
  );
}