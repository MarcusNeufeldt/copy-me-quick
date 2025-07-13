'use client';

import { Code2, GithubIcon } from 'lucide-react';
import { ModeToggle } from "@/components/ui/mode-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm shadow-sm">
      <div className="container flex h-16 items-center justify-between py-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-lg sm:text-xl font-heading font-bold text-gradient">Copy Me Quick</h1>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href="https://github.com/MarcusNeufeldt/copy-me-quick" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}