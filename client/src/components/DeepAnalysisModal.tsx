import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Users, Target, Calendar as CalendarDays, CheckCircle2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface DeepAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  onConfirm: (parameters: AnalysisParameters) => void;
  clarifyingQuestions?: Array<{question: string; placeholder: string}>;
  clarifyingAnswers?: Record<number, string>;
  onClarifyingAnswerChange?: (index: number, value: string) => void;
  onAnswerChange?: (index: number, answer: string) => void;
  isLoadingQuestions?: boolean;
  analysisSetup?: {
    heading: string;
    description: string;
    hypothesis: string;
    statisticalTest: string;
    userCohort: string;
    timeFrame: string;
  };
}

interface AnalysisParameters {
  question: string;
  timeRanges: {
    nightStart: string;
    nightEnd: string;
    dayStart: string;
    dayEnd: string;
  };
  outcomeWindow: string;
  customWindowDays?: number;
  playerCohort: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

const timeOptions = Array.from({ length: 24 }, (_, i) => 
  String(i).padStart(2, '0') + ':00'
);

const cohortOptions = [
  { id: 'all', label: 'All Active Players', description: 'All users with activity in the period' },
  { id: 'new', label: 'New Installs', description: 'Users who installed during the period' },
  { id: 'paying', label: 'Paying Users', description: 'Users with at least one purchase' },
  { id: 'engaged', label: 'Highly Engaged', description: 'Top 25% by session frequency' },
  { id: 'churned', label: 'At-Risk Users', description: 'Users with declining engagement' }
];

const outcomeOptions = [
  { value: 'same-day', label: 'Same Calendar Day' },
  { value: 'next-day', label: 'Next Calendar Day' },
  { value: 'custom', label: 'Custom Window' }
];

const getExamplePlaceholder = (question: string, defaultPlaceholder: string): string => {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('metric') || lowerQuestion.includes('measuring')) {
    return "e.g., daily active sessions, revenue per user, conversion rate";
  }
  
  if (lowerQuestion.includes('compare') || lowerQuestion.includes('against')) {
    return "e.g., non-booster users, previous month, control group";
  }
  
  if (lowerQuestion.includes('time') || lowerQuestion.includes('period')) {
    return "e.g., last 30 days, this quarter, past 6 months";
  }
  
  if (lowerQuestion.includes('cohort') || lowerQuestion.includes('group') || lowerQuestion.includes('users')) {
    return "e.g., premium users, new signups, active players";
  }
  
  if (lowerQuestion.includes('threshold') || lowerQuestion.includes('criteria')) {
    return "e.g., 10+ sessions per week, $50+ monthly revenue";
  }
  
  return defaultPlaceholder;
};

export default function DeepAnalysisModal({ 
  isOpen, 
  onClose, 
  question, 
  onConfirm, 
  clarifyingQuestions = [], 
  clarifyingAnswers = {}, 
  onClarifyingAnswerChange,
  isLoadingQuestions = false,
  analysisSetup
}: DeepAnalysisModalProps) {
  const [step, setStep] = useState(1);
  

  const [parameters, setParameters] = useState<AnalysisParameters>({
    question,
    timeRanges: {
      nightStart: '00:00',
      nightEnd: '04:59',
      dayStart: '08:00',
      dayEnd: '19:59'
    },
    outcomeWindow: 'next-day',
    playerCohort: ['all'],
    dateRange: {
      start: new Date(new Date().setMonth(new Date().getMonth() - 3)),
      end: new Date()
    }
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState<'start' | 'end' | null>(null);

  const handleTimeChange = (field: keyof AnalysisParameters['timeRanges'], value: string) => {
    setParameters(prev => ({
      ...prev,
      timeRanges: {
        ...prev.timeRanges,
        [field]: value
      }
    }));
  };

  const handleCohortToggle = (cohortId: string) => {
    setParameters(prev => {
      const newCohorts = prev.playerCohort.includes(cohortId)
        ? prev.playerCohort.filter(id => id !== cohortId)
        : [...prev.playerCohort, cohortId];
      
      return {
        ...prev,
        playerCohort: newCohorts.length > 0 ? newCohorts : ['all']
      };
    });
  };

  const generateSummary = () => {
    const cohortLabels = parameters.playerCohort.map(id => 
      cohortOptions.find(opt => opt.id === id)?.label || id
    ).join(', ');
    
    const windowText = parameters.outcomeWindow === 'custom' 
      ? `${parameters.customWindowDays}-day window`
      : outcomeOptions.find(opt => opt.value === parameters.outcomeWindow)?.label;

    return `Compare day-time sessions (${parameters.timeRanges.dayStart}–${parameters.timeRanges.dayEnd}) following night-time activity (${parameters.timeRanges.nightStart}–${parameters.timeRanges.nightEnd}) within ${windowText} for ${cohortLabels} between ${format(parameters.dateRange.start, 'MMM d')} – ${format(parameters.dateRange.end, 'MMM d, yyyy')}.`;
  };

  const isValid = () => {
    return parameters.playerCohort.length > 0 && 
           parameters.dateRange.start < parameters.dateRange.end &&
           (parameters.outcomeWindow !== 'custom' || (parameters.customWindowDays && parameters.customWindowDays > 0));
  };

  const handleStartAnalysis = () => {
    // Start analysis with smart defaults, skip advanced options
    const defaultParameters = {
      ...parameters,
      question: question,
      timeRanges: {
        nightStart: "20:00",
        nightEnd: "06:00", 
        dayStart: "08:00",
        dayEnd: "18:00"
      },
      outcomeWindow: "next-day",
      playerCohort: ["all"],
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      }
    };
    onConfirm(defaultParameters);
    onClose();
    setStep(1);
  };

  const handleConfirm = () => {
    if (isValid()) {
      onConfirm(parameters);
      onClose();
      setStep(1);
    }
  };

  const handleClose = () => {
    onClose();
    setStep(1);
  };



  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Deep Analysis Setup</span>
          </DialogTitle>
          <DialogDescription>
            Configure parameters for comprehensive statistical analysis
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Analysis Question
              </h3>
              <p className="text-lg font-medium text-foreground">"{question}"</p>
            </div>

            {/* Loading state */}
            {isLoadingQuestions && (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Analyzing question...</span>
                </div>
              </div>
            )}

            {/* Only show clarifying questions returned by OpenAI */}
            {clarifyingQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center">
                  <Target className="h-4 w-4 mr-2 text-blue-600" />
                  Help us understand your question better
                </h3>
                <div className="space-y-4">
                  {clarifyingQuestions.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        {item.question}
                      </Label>
                      <Input
                        placeholder={getExamplePlaceholder(item.question, item.placeholder)}
                        value={clarifyingAnswers[index] || ""}
                        onChange={(e) => onClarifyingAnswerChange?.(index, e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show complete analysis setup if OpenAI determined question is complete */}
            {analysisSetup && (
              <div className="space-y-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Analysis Setup Complete
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Heading:</span> {analysisSetup.heading}
                  </div>
                  <div>
                    <span className="font-medium">Description:</span> {analysisSetup.description}
                  </div>
                  <div>
                    <span className="font-medium">Hypothesis:</span> {analysisSetup.hypothesis}
                  </div>
                  <div>
                    <span className="font-medium">Statistical Test:</span> {analysisSetup.statisticalTest}
                  </div>
                  <div>
                    <span className="font-medium">User Cohort:</span> {analysisSetup.userCohort}
                  </div>
                  <div>
                    <span className="font-medium">Time Frame:</span> {analysisSetup.timeFrame}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {analysisSetup 
                  ? "Analysis parameters are ready. Click 'Start Analysis' to proceed with default settings, or 'Advanced Options' for detailed configuration."
                  : "This analysis will require specific parameters to ensure accurate results. Click 'Start Analysis' to proceed with smart defaults, or 'Advanced Options' for detailed configuration."
                }
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleStartAnalysis} className="flex-1 bg-primary">
                  Start Analysis
                </Button>
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Advanced Options
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-primary">Analysis Setup Preview</h3>
              <p className="text-sm text-muted-foreground">{generateSummary()}</p>
            </div>

            {/* Time Ranges */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Time Range Definitions</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Night-time Period</Label>
                  <div className="flex space-x-2">
                    <Select value={parameters.timeRanges.nightStart} onValueChange={(value) => handleTimeChange('nightStart', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="self-center text-muted-foreground">to</span>
                    <Select value={parameters.timeRanges.nightEnd} onValueChange={(value) => handleTimeChange('nightEnd', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Day-time Period</Label>
                  <div className="flex space-x-2">
                    <Select value={parameters.timeRanges.dayStart} onValueChange={(value) => handleTimeChange('dayStart', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="self-center text-muted-foreground">to</span>
                    <Select value={parameters.timeRanges.dayEnd} onValueChange={(value) => handleTimeChange('dayEnd', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Outcome Window */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Outcome Window</Label>
              </div>
              <div className="space-y-2">
                <Select value={parameters.outcomeWindow} onValueChange={(value) => setParameters(prev => ({ ...prev, outcomeWindow: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="When to count day-time sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {parameters.outcomeWindow === 'custom' && (
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      placeholder="Number of days"
                      value={parameters.customWindowDays || ''}
                      onChange={(e) => setParameters(prev => ({ 
                        ...prev, 
                        customWindowDays: parseInt(e.target.value) || undefined 
                      }))}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">days after night-time activity</span>
                  </div>
                )}
              </div>
            </div>

            {/* Player Cohort */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Player Cohort</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {cohortOptions.map(cohort => (
                  <div
                    key={cohort.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      parameters.playerCohort.includes(cohort.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleCohortToggle(cohort.id)}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded border-2 ${
                        parameters.playerCohort.includes(cohort.id)
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {parameters.playerCohort.includes(cohort.id) && (
                          <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{cohort.label}</p>
                        <p className="text-xs text-muted-foreground">{cohort.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Date Range</Label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={isDatePickerOpen === 'start'} onOpenChange={(open) => setIsDatePickerOpen(open ? 'start' : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(parameters.dateRange.start, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parameters.dateRange.start}
                      onSelect={(date) => {
                        if (date) {
                          setParameters(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, start: date }
                          }));
                          setIsDatePickerOpen(null);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="self-center text-muted-foreground hidden sm:block">to</span>

                <Popover open={isDatePickerOpen === 'end'} onOpenChange={(open) => setIsDatePickerOpen(open ? 'end' : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(parameters.dateRange.end, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parameters.dateRange.end}
                      onSelect={(date) => {
                        if (date) {
                          setParameters(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, end: date }
                          }));
                          setIsDatePickerOpen(null);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button 
                onClick={handleConfirm} 
                disabled={!isValid()}
                className="flex-1"
              >
                Run Analysis
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStep(1)}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}