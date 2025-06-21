import React from "react";
import { Link, useLocation } from "wouter";
import { BarChart3, Eye, Settings, FlaskConical, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import logoPath from "@assets/X-gaming-logo_1749489510040.png";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    {
      name: "Analytics",
      path: "/",
      icon: BarChart3,
    },
    {
      name: "Experiments",
      path: "/experiments",
      icon: FlaskConical,
    },
    {
      name: "Business Snapshot",
      path: "/business-snapshot",
      icon: Eye,
    },
    {
      name: "Connect",
      path: "/connect",
      icon: Settings,
    },
    {
      name: "Remote Config",
      path: "/remote-config",
      icon: Zap,
    },
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo on the left */}
          <div className="flex items-center">
            <img src={logoPath} alt="X-Gaming" className="h-8 w-auto" />
          </div>
          
          {/* Navigation items on the right */}
          <div className="flex space-x-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}