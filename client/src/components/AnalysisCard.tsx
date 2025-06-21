import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, X, FileText, Target, BarChart3, Users, Calendar, TestTube, Lightbulb, Activity, Clock, ChevronRight, Check, Edit2, ChevronDown } from "lucide-react";
import { getTags, getTagColorClass, type Tag } from "@/lib/tagger";

interface AnalysisCardProps {
  question: string;
  questionId?: number;
  status: 'queued' | 'waiting-for-answers' | 'ready';
  parameters?: {
    timeRanges?: { nightStart: string; nightEnd: string; dayStart: string; dayEnd: string };
    outcomeWindow?: string;
    playerCohort?: string[];
    dateRange?: { start: Date; end: Date };
  };
  clarifyingQuestions?: Array<{ question: string; answer: string | null }>;
  onCancel?: () => void;
  onGenerateBrief?: () => void;
  onSendAnswers?: () => void;
  onDeepDive?: () => void;
}

export default function AnalysisCard({
  question,
  questionId,
  status,
  parameters,
  clarifyingQuestions = [],
  onCancel,
  onGenerateBrief,
  onSendAnswers,
  onDeepDive
}: AnalysisCardProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryModal, setSummaryModal] = useState<any>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [answers, setAnswers] = useState<{[key: number]: string}>({});
  const [draftAnswers, setDraftAnswers] = useState<{[key: number]: string}>({});
  const [suggestedAnswers, setSuggestedAnswers] = useState<{[key: number]: string}>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<{[key: number]: boolean}>({});
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Fetch tags only when question is initially submitted (not on every render)
  useEffect(() => {
    const fetchTags = async () => {
      // Only fetch tags if we don't have them yet for this question
      if (tags.length === 0 && !isLoadingTags) {
        setIsLoadingTags(true);
        try {
          const fetchedTags = await getTags(question);
          setTags(fetchedTags);
        } catch (error) {
          console.error('Error fetching tags:', error);
          setTags(["Engagement"]);
        } finally {
          setIsLoadingTags(false);
        }
      }
    };

    fetchTags();
  }, [question]);

  // Fetch suggested answers for clarifying questions
  useEffect(() => {
    const fetchSuggestedAnswers = async () => {
      if (clarifyingQuestions.length === 0) return;

      clarifyingQuestions.forEach(async (q, index) => {
        if (!q.answer && !suggestedAnswers[index]) {
          setLoadingSuggestions(prev => ({ ...prev, [index]: true }));
          
          try {
            const response = await fetch('/api/generate-suggested-answer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question: question,
                clarifyingQuestion: q.question || q
              })
            });

            if (response.ok) {
              const { suggestedAnswer } = await response.json();
              setSuggestedAnswers(prev => ({ ...prev, [index]: suggestedAnswer }));
            }
          } catch (error) {
            console.error('Error fetching suggested answer:', error);
          } finally {
            setLoadingSuggestions(prev => ({ ...prev, [index]: false }));
          }
        }
      });
    };

    fetchSuggestedAnswers();
  }, [clarifyingQuestions, question]);

  // Check if all clarifying questions are answered
  const allQuestionsAnswered = clarifyingQuestions.length > 0 && 
    clarifyingQuestions.every((_, index) => answers[index]?.trim().length > 0);

  // Handle draft answer change (typing)
  const handleDraftChange = (index: number, value: string) => {
    setDraftAnswers(prev => ({
      ...prev,
      [index]: value
    }));
  };

  // Confirm answer (Enter key or button click)
  const confirmAnswer = (index: number) => {
    const draftValue = draftAnswers[index];
    if (draftValue && draftValue.trim()) {
      setAnswers(prev => ({
        ...prev,
        [index]: draftValue.trim()
      }));
      setDraftAnswers(prev => ({
        ...prev,
        [index]: ''
      }));
      
      // Re-tag the question when clarifying questions are completed
      const totalAnswered = Object.keys(answers).length + 1; // +1 for the current answer
      if (totalAnswered === clarifyingQuestions.length) {
        refreshTags();
      }
    }
  };

  // Function to refresh tags when clarifying questions are completed
  const refreshTags = async () => {
    setIsLoadingTags(true);
    try {
      const fetchedTags = await getTags(question);
      setTags(fetchedTags);
    } catch (error) {
      console.error('Error refreshing tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  // Handle answer change for suggestions
  const handleAnswerChange = (index: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const handleSummarizeClick = async () => {
    if (!questionId) {
      onGenerateBrief?.();
      return;
    }

    setIsLoadingSummary(true);
    try {
      const response = await fetch(`/api/questions/${questionId}/summary`);
      if (response.ok) {
        const summaryData = await response.json();
        setSummaryModal(summaryData);
      } else {
        // Fallback to generating new brief if no saved summary
        onGenerateBrief?.();
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      onGenerateBrief?.();
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'queued': return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Queued</Badge>;
      case 'waiting-for-answers': return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Waiting</Badge>;
      case 'ready': return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Ready</Badge>;
    }
  };

  const truncateQuestion = (text: string, maxLength: number = 120) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };



  const formatParameterValue = (key: string, value: any): string => {
    if (key === 'timeRanges' && value) {
      return `Night: ${value.nightStart}-${value.nightEnd}, Day: ${value.dayStart}-${value.dayEnd}`;
    }
    if (key === 'dateRange' && value) {
      const start = new Date(value.start).toLocaleDateString();
      const end = new Date(value.end).toLocaleDateString();
      return `${start} - ${end}`;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  const pendingQuestions = clarifyingQuestions.filter((q, index) => !(q.answer && q.answer.trim()) && !(answers[index] && answers[index].trim()));
  const hasAnsweredQuestions = clarifyingQuestions.some(q => q.answer) || Object.values(answers).some(a => a?.trim());
  const canSendAnswers = status === 'waiting-for-answers' && pendingQuestions.length === 0;

  return (
    <>
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-2 flex-1 mr-3">
              <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <h3 className="font-semibold text-sm leading-5 break-words">{question}</h3>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {getStatusBadge()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                aria-label="Cancel analysis"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Multiple Tags */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {isLoadingTags ? (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                  Loading...
                </Badge>
              ) : (
                tags.map((tag, index) => (
                  <Badge 
                    key={index}
                    variant="outline" 
                    className={`text-xs ${getTagColorClass(tag)}`}
                  >
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Parameters Block */}
          {parameters && Object.keys(parameters).length > 0 && (
            <div className="mb-3">
              <h4 className="font-medium text-sm mb-2">Parameters</h4>
              <div className="space-y-1 text-xs">
                {Object.entries(parameters)
                  .filter(([, value]) => value !== undefined && value !== null)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                      <span className="text-gray-700 max-w-[200px] truncate">
                        {formatParameterValue(key, value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Clarification Section - Only for Pending Questions */}
          {clarifyingQuestions.length > 0 && pendingQuestions.length > 0 && (
            <div className="mb-3">
              <h4 className="font-medium text-sm mb-2">Clarification Needed</h4>
              <ol className="space-y-3 text-xs">
                {clarifyingQuestions.map((q, index) => {
                  const isAnswered = (q.answer && q.answer.trim()) || (answers[index] && answers[index].trim());
                  if (isAnswered) return null; // Skip answered questions in this section
                  
                  return (
                    <li key={index} className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-500 mt-0.5">{index + 1}.</span>
                        <span className="text-gray-700 flex-1">{q.question}</span>
                      </div>
                      <div className="ml-5">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Input
                              placeholder={
                                loadingSuggestions[index] 
                                  ? "Generating suggestion..." 
                                  : suggestedAnswers[index] 
                                    ? `Suggestion: ${suggestedAnswers[index]}` 
                                    : "Type your answer here..."
                              }
                              value={draftAnswers[index] || ''}
                              onChange={(e) => handleDraftChange(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && (draftAnswers[index] || '').trim()) {
                                  e.preventDefault();
                                  confirmAnswer(index);
                                }
                              }}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck="false"
                              className="text-xs h-7 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 flex-1"
                            />
                            {(draftAnswers[index] || '').trim() && (
                              <button
                                onClick={() => confirmAnswer(index)}
                                className="text-xs text-green-600 hover:text-green-800 px-2 py-1 border border-green-200 rounded bg-green-50"
                                title="Click to confirm answer"
                              >
                                ✓
                              </button>
                            )}
                          </div>
                          {suggestedAnswers[index] && !answers[index] && (
                            <button
                              onClick={() => handleAnswerChange(index, suggestedAnswers[index])}
                              className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                            >
                              Use suggestion
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Completed Questions Section - Collapsible View */}
          {clarifyingQuestions.length > 0 && hasAnsweredQuestions && (
            <div className="mb-3">
              <div 
                className="flex items-center cursor-pointer py-1"
                onClick={() => setCompletedExpanded(!completedExpanded)}
              >
                <h4 className="font-medium text-sm text-green-700">Questions Completed</h4>
                <div className="ml-2">
                  {completedExpanded ? (
                    <ChevronDown className="w-4 h-4 text-green-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-green-600" />
                  )}
                </div>
              </div>
              
              {completedExpanded && (
                <div className="space-y-2 text-xs mt-2">
                  {clarifyingQuestions.map((q, index) => {
                    const currentAnswer = answers[index] || q.answer;
                    if (!currentAnswer?.trim()) return null; // Skip unanswered questions
                    
                    return (
                      <div key={index} className="flex items-start space-x-2 py-1">
                        <div className="mt-0.5">
                          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded flex items-center justify-center">
                            <Check className="w-2 h-2 text-green-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <span className="text-gray-700 block mb-1">{q.question}</span>
                          {editingQuestion === index ? (
                            <div className="space-y-1">
                              <Input
                                value={answers[index] || q.answer || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                className="text-xs h-7 bg-white border-gray-200"
                                autoFocus
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setEditingQuestion(null)}
                                  className="text-xs text-green-600 hover:text-green-800"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingQuestion(null);
                                    // Reset to original answer if canceling
                                    if (q.answer) {
                                      setAnswers(prev => ({ ...prev, [index]: q.answer! }));
                                    }
                                  }}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-green-50 px-2 py-1 rounded border border-green-200">
                              <span className="text-green-700">{currentAnswer}</span>
                              <button
                                onClick={() => {
                                  setEditingQuestion(index);
                                  // Pre-populate with current answer
                                  if (!answers[index]) {
                                    setAnswers(prev => ({ ...prev, [index]: currentAnswer }));
                                  }
                                }}
                                className="text-gray-400 hover:text-gray-600 ml-2"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}



          {/* Primary Action Button */}
          <div className="flex justify-center">
            {status === 'queued' && (
              <Button
                onClick={handleSummarizeClick}
                variant="outline"
                className="w-full"
                size="sm"
                disabled={isLoadingSummary}
              >
                <FileText className="h-4 w-4 mr-2" />
                {isLoadingSummary ? "Loading..." : "Summarize"}
              </Button>
            )}
            {status === 'waiting-for-answers' && (
              <Button
                onClick={onSendAnswers}
                disabled={!canSendAnswers}
                className="w-full"
                size="sm"
              >
                Send Answers
              </Button>
            )}
            {status === 'ready' && (
              <Button
                onClick={onGenerateBrief}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Open Results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Modal */}
      <Dialog open={!!summaryModal} onOpenChange={() => setSummaryModal(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Analysis Brief</DialogTitle>
                <DialogDescription className="text-sm">
                  Board-room ready analysis summary
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {summaryModal && (
            <div className="space-y-6">
              {/* Analysis Focus - Hero Section */}
              <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-500 rounded-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-blue-900 dark:text-blue-100 mb-2">Analysis Focus</h3>
                    <p className="text-blue-800 dark:text-blue-200 font-medium text-base leading-relaxed">{summaryModal.heading}</p>
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                    Strategic Analysis
                  </div>
                </div>
              </div>
              
              {/* What We'll Discover */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-green-500 rounded-lg">
                    <Lightbulb className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-green-900 dark:text-green-100 mb-3">What We'll Discover</h4>
                    <p className="text-green-800 dark:text-green-200 text-sm leading-relaxed">{summaryModal.description}</p>
                  </div>
                </div>
              </div>
              
              {/* Hypothesis to Test */}
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-purple-500 rounded-lg">
                    <TestTube className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-purple-900 dark:text-purple-100 mb-3">Hypothesis to Test</h4>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                      <p className="text-purple-800 dark:text-purple-200 text-sm leading-relaxed italic">{summaryModal.hypothesis}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Analysis Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-orange-900 dark:text-orange-100">Statistical Test</h4>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                    <p className="text-orange-800 dark:text-orange-200 text-sm font-medium">{summaryModal.statisticalTest}</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-cyan-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-cyan-900 dark:text-cyan-100">User Cohort</h4>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                    <p className="text-cyan-800 dark:text-cyan-200 text-sm font-medium">{summaryModal.userCohort}</p>
                  </div>
                </div>
              </div>
              
              {/* Time Frame */}
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-rose-200 dark:border-rose-800">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-rose-500 rounded-lg">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-rose-900 dark:text-rose-100 mb-3">Time Frame</h4>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                      <p className="text-rose-800 dark:text-rose-200 text-sm font-medium">{summaryModal.timeFrame}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Analysis parameters ready</span>
                </div>
                <Button 
                  onClick={() => setSummaryModal(null)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  <ChevronRight className="h-4 w-4 ml-2" />
                  Continue to Analysis
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this analysis?</DialogTitle>
            <DialogDescription>
              If you cancel, this question will be removed from your queue. You can always ask it again later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onCancel?.();
                setShowCancelModal(false);
              }}
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            >
              Cancel Analysis
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              className="flex-1"
            >
              Continue Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}