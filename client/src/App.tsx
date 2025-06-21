import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/Navigation";
import Dashboard from "@/pages/dashboard";
import ExperimentsPage from "@/pages/experiments";
import BusinessSnapshot from "@/pages/business-snapshot";
import Connect from "@/pages/connect";
import RemoteConfig from "@/pages/remote-config";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/experiments" component={ExperimentsPage} />
      <Route path="/business-snapshot" component={BusinessSnapshot} />
      <Route path="/connect" component={Connect} />
      <Route path="/remote-config" component={RemoteConfig} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-6">
            <Router />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
