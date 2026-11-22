'use client';

import React, { Suspense } from 'react';
import { AgentStudioStudio } from '@/features/agents/AgentStudioStudio';

export default function AgentsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Agent Studio...</div>}>
        <AgentStudioStudio />
      </Suspense>
    </div>
  );
}
