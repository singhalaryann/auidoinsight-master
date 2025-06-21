import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Mic, Send, BarChart3, Volume2, VolumeX, HelpCircle, MessageSquare, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { useLocation } from "wouter";
import DeepAnalysisModal from "./DeepAnalysisModal";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: number;
  text: string;
  timestamp: string;
}

interface QuestionInputProps {
  onSubmit: (question: string, source?: string) => Promise<{ needsClarification: boolean; clarificationQuestions?: any[] }>;
  onDeepAnalysis?: (question: string, parameters: any) => void;
  isProcessing: boolean;
  recentQuestions: Question[];
}

export default function QuestionInput({ onSubmit, onDeepAnalysis, isProcessing, recentQuestions }: QuestionInputProps) {
  const [question, setQuestion] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const [, setLocation] = useLocation();
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [showDeepAnalysisModal, setShowDeepAnalysisModal] = useState(false);
  const [pendingDeepAnalysisQuestion, setPendingDeepAnalysisQuestion] = useState("");
  const [clarifyingQuestions, setClarifyingQuestions] = useState<Array<{question: string; placeholder: string}>>([]);
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<number, string>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [analysisSetup, setAnalysisSetup] = useState<any>(null);
  const [quickStartQuestions, setQuickStartQuestions] = useState<string[]>([]);
  const [isLoadingQuickStart, setIsLoadingQuickStart] = useState(false);
  const { toast } = useToast();

  // Load QuickStart questions on component mount
  useEffect(() => {
    fetchQuickStartQuestions();
  }, []);

  const fetchQuickStartQuestions = async () => {
    setIsLoadingQuickStart(true);
    try {
      const response = await fetch('/api/quickstart-questions?count=4');
      if (response.ok) {
        const data = await response.json();
        setQuickStartQuestions(data.questions);
      } else {
        // Fallback to default questions if API fails
        setQuickStartQuestions([
          "What's our weekly retention rate?",
          "How do premium users behave differently?",
          "Which features drive the most engagement?",
          "What's our user acquisition cost this month?"
        ]);
      }
    } catch (error) {
      console.error('Error fetching QuickStart questions:', error);
      // Fallback to default questions
      setQuickStartQuestions([
        "What's our weekly retention rate?",
        "How do premium users behave differently?",
        "Which features drive the most engagement?",
        "What's our user acquisition cost this month?"
      ]);
    } finally {
      setIsLoadingQuickStart(false);
    }
  };

  // Voice command handlers
  const handleVoiceTranscription = (text: string) => {
    setQuestion(text);
  };

  const handleVoiceCommand = (command: string, params?: any) => {
    switch (command) {
      case 'retention':
      case 'conversion':
      case 'engagement':
        setActiveTab("general");
        const questionText = `Analyze ${params?.focus || command} metrics and provide insights`;
        setQuestion(questionText);
        break;
      case 'clear':
        setQuestion("");
        break;
      case 'submit':
        if (question.trim()) {
          handleSubmit();
        }
        break;
      case 'navigate':
        if (params?.destination === 'dashboard') {
          setLocation('/');
        } else if (params?.destination === 'business-snapshot') {
          setLocation('/business-snapshot');
        }
        break;
      case 'general_question':
        setActiveTab("general");
        if (params?.text) {
          setQuestion(params.text);
        }
        break;
    }
  };

  const handleVoiceError = (error: string) => {
    console.error('Voice command error:', error);
  };

  const voiceCommands = useVoiceCommands({
    onTranscription: handleVoiceTranscription,
    onCommand: handleVoiceCommand,
    onError: handleVoiceError,
    language: 'en-US',
    continuous: false,
    interimResults: true
  });

  const handleSubmit = async () => {
    if (question.trim()) {
      const questionText = question.trim();
      try {
        const result = await onSubmit(questionText);
        
        if (result.needsClarification) {
          // Show clarification modal instead of submitting to insights
          setClarifyingQuestions(result.clarificationQuestions || []);
          setPendingDeepAnalysisQuestion(questionText);
          setShowDeepAnalysisModal(true);
        } else {
          // Question was complete and submitted to insights
          setQuestion("");
          toast({
            title: "Question Submitted",
            description: "Your question has been added to the insights queue.",
          });
        }
      } catch (error) {
        console.error('Error submitting question:', error);
      }
    }
  };

  // Generate analysis setup when opening the deep analysis modal
  const generateAnalysisSetup = async (questionText: string) => {
    setIsLoadingQuestions(true);
    try {
      const response = await fetch('/api/analysis-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: questionText })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAnalysisSetup(data.setup);
      setClarifyingQuestions(data.clarifyingQuestions || []);
      setPendingDeepAnalysisQuestion(questionText);
      setShowDeepAnalysisModal(true);
    } catch (error: any) {
      console.error('Error generating analysis setup:', error);
      toast({
        title: "Error",
        description: "Failed to generate analysis setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleDeepAnalysisRequest = () => {
    if (question.trim()) {
      generateAnalysisSetup(question.trim());
    }
  };

  const handleDeepAnalysisConfirm = (parameters: any) => {
    // Create clarifying questions array with answers for database storage
    const answeredQuestions = clarifyingQuestions.map((item, index) => ({
      question: item.question,
      answer: clarifyingAnswers[index] || ""
    }));
    
    // Include clarifying questions in the analysis parameters
    const analysisParameters = {
      ...parameters,
      clarifyingQuestions: answeredQuestions
    };
    
    // Submit to deep analysis handler with clarifying questions stored separately
    if (onDeepAnalysis) {
      onDeepAnalysis(pendingDeepAnalysisQuestion, analysisParameters);
      
      setQuestion("");
      setPendingDeepAnalysisQuestion("");
      setClarifyingQuestions([]);
      setClarifyingAnswers({});
      setAnalysisSetup(null);
      setShowDeepAnalysisModal(false);
      
      toast({
        title: "Analysis Started",
        description: "Your refined question has been added to the insights queue.",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    voiceCommands.toggleListening();
  };

  // Voice status indicator
  const getVoiceStatusIcon = () => {
    if (voiceCommands.isListening) {
      if (voiceCommands.isNoiseFiltered) {
        return <Volume2 className="h-4 w-4 text-green-500" />;
      } else {
        return <VolumeX className="h-4 w-4 text-orange-500" />;
      }
    }
    return <Mic className="h-4 w-4" />;
  };

  const getVoiceButtonClass = () => {
    if (voiceCommands.isListening) {
      if (voiceCommands.isNoiseFiltered) {
        return "p-2 bg-green-50 text-green-500 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900";
      } else {
        return "p-2 bg-orange-50 text-orange-500 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-400 dark:hover:bg-orange-900";
      }
    }
    return "p-2 text-muted-foreground hover:text-primary";
  };

  const handleQuickQuestion = (questionText: string) => {
    setQuestion(questionText);
    onSubmit(questionText);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg border fade-in">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Ask Anything</h2>
            <span className="text-sm text-muted-foreground italic">
              Engagement, retention, revenue—just type or talk.
            </span>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center bg-background border rounded-xl p-1 focus-within:ring-2 focus-within:ring-ring pl-[0px] pr-[0px] pt-[0px] pb-[0px]">
              <Input
                type="text"
                placeholder="What's our weekly retention rate?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-5 py-3 text-lg border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isProcessing || voiceCommands.isListening}
              />
              <div className="flex items-center space-x-1 pl-[0px] pr-[0px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className={`h-10 w-10 p-0 ${getVoiceButtonClass()}`}
                  title={voiceCommands.isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {getVoiceStatusIcon()}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVoiceHelp(!showVoiceHelp)}
                  className="h-10 w-10 p-0 text-muted-foreground hover:text-primary"
                  title="Voice command help"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isProcessing}
                  className="h-10 w-10 p-0 text-muted-foreground hover:text-primary"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!question.trim() || isProcessing || voiceCommands.isListening}
                  className="h-10 px-4 ml-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Go
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Voice Help Section */}
            {showVoiceHelp && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Voice Commands</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>• "Ask about retention"</div>
                  <div>• "Clear input"</div>
                  <div>• "Submit question"</div>
                  <div>• "Navigate to dashboard"</div>
                </div>
              </div>
            )}

            {/* Starter Questions */}
            {question === "" && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">QuickStart Questions</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchQuickStartQuestions}
                    disabled={isLoadingQuickStart}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                    title="Refresh questions"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingQuickStart ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {quickStartQuestions.map((suggestion, index) => (
                    <Button
                      key={`${suggestion}-${index}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickQuestion(suggestion)}
                      className="text-left h-auto p-3 justify-start text-wrap hover:bg-muted/50"
                      disabled={isProcessing || isLoadingQuickStart}
                    >
                      <span className="text-sm text-foreground">{suggestion}</span>
                    </Button>
                  ))}
                </div>
                {isLoadingQuickStart && (
                  <div className="text-center py-2">
                    <span className="text-xs text-muted-foreground">Generating fresh questions...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Deep Analysis Modal */}
      <DeepAnalysisModal
        isOpen={showDeepAnalysisModal}
        onClose={() => {
          setShowDeepAnalysisModal(false);
          setPendingDeepAnalysisQuestion("");
          setClarifyingQuestions([]);
          setClarifyingAnswers({});
          setAnalysisSetup(null);
        }}
        question={pendingDeepAnalysisQuestion}
        clarifyingQuestions={clarifyingQuestions}
        clarifyingAnswers={clarifyingAnswers}
        onClarifyingAnswerChange={(index, answer) => {
          setClarifyingAnswers(prev => ({ ...prev, [index]: answer }));
        }}
        onConfirm={handleDeepAnalysisConfirm}
        analysisSetup={analysisSetup}
      />
    </div>
  );
}