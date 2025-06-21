import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, FileText, TestTube, Calculator, Users, Calendar } from "lucide-react";

interface AnalysisBrief {
  heading: string;
  description: string;
  hypothesis: string;
  statisticalTest: string;
  userCohort: string;
  timeFrame: string;
}

interface AnalysisBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: AnalysisBrief | null;
  question: string;
  isLoading: boolean;
}

export default function AnalysisBriefModal({ isOpen, onClose, brief, question, isLoading }: AnalysisBriefModalProps) {
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generating Analysis Brief</DialogTitle>
            <DialogDescription>
              Creating board-room ready analysis summary...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-3 text-muted-foreground">Processing with AI...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!brief) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Analysis Brief</span>
          </DialogTitle>
          <DialogDescription>
            Board-room ready analysis summary
          </DialogDescription>
        </DialogHeader>

        {/* Original Question */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <h4 className="font-medium text-sm mb-2 text-gray-700 dark:text-gray-300">Original Question</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">"{question}"</p>
        </div>

        <div className="space-y-6">
          {/* Analysis Focus */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Analysis Focus</h3>
            </div>
            <p className="text-blue-800 dark:text-blue-200 font-medium">{brief.heading}</p>
          </div>

          {/* What We'll Discover */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">What We'll Discover</h3>
            </div>
            <p className="text-foreground leading-relaxed">{brief.description}</p>
          </div>

          {/* Hypothesis to Test */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <TestTube className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold">Hypothesis to Test</h3>
            </div>
            <p className="text-foreground leading-relaxed">{brief.hypothesis}</p>
          </div>

          {/* Statistical Approach */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Calculator className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Statistical Approach</h3>
            </div>
            <p className="text-foreground leading-relaxed">{brief.statisticalTest}</p>
          </div>

          {/* User Cohort & Time Frame */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">User Cohort</h3>
              </div>
              <p className="text-foreground leading-relaxed">{brief.userCohort}</p>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold">Time Frame</h3>
              </div>
              <p className="text-foreground leading-relaxed">{brief.timeFrame}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center pt-4">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Analysis Brief Generated
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}