'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';
import { SettingsHeader } from '@/features/settings/SettingsHeader';
import { SettingsCategoryTabs } from '@/features/settings/SettingsCategoryTabs';
import { GeneralSettingsPanel } from '@/features/settings/GeneralSettingsPanel';
import { AppearanceSettingsCard } from '@/features/settings/AppearanceSettingsCard';
import { CallingServicePanel } from '@/features/settings/CallingServicePanel';
import { AiVoiceSettingsPanel } from '@/features/settings/AiVoiceSettingsPanel';
import { AiModelSettingsPanel } from '@/features/settings/AiModelSettingsPanel';
import { WorkingHoursPanel } from '@/features/settings/WorkingHoursPanel';
import { UsersRolesPanel } from '@/features/settings/UsersRolesPanel';
import { IntegrationsPanel } from '@/features/settings/IntegrationsPanel';
import { StorageSecurityPanel } from '@/features/settings/StorageSecurityPanel';
import { EmailAutomationPanel } from '@/features/settings/EmailAutomationPanel';

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') || 'general';
  const normalizedTab =
    tabParam === 'providers' ? 'integrations' : tabParam === 'guardrails' ? 'working-hours' : tabParam;
  const [activeCategory, setActiveCategory] = useState(normalizedTab);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleDeploy = () => {
    setIsDeploying(true);
    setShowToast(true);

    setTimeout(() => {
      setIsDeploying(false);
      setShowToast(false);
    }, 2000);
  };

  const currentTab = activeCategory === 'providers' ? 'integrations' : activeCategory;

  return (
    <div className="rm-page flex min-h-[calc(100vh-4rem)] w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-5 lg:p-6">
        {/* Top Action Bar & Settings Title */}
        <SettingsHeader onDeploy={handleDeploy} isDeploying={isDeploying} />

        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsCategoryTabs
          activeCategory={currentTab}
          onSelectCategory={(cat) => setActiveCategory(cat)}
        />

        <div className="min-w-0">
        {currentTab === 'general' && <GeneralSettingsPanel />}

        {(currentTab === 'appearance' || currentTab === 'theme') && <AppearanceSettingsCard />}

        {(currentTab === 'calling' || currentTab === 'telephony') && <CallingServicePanel />}

        {(currentTab === 'ai-voice' || currentTab === 'voice_ai' || currentTab === 'voice') && (
          <AiVoiceSettingsPanel />
        )}

        {(currentTab === 'ai-model' || currentTab === 'model') && <AiModelSettingsPanel />}

        {(currentTab === 'working-hours' || currentTab === 'hours' || currentTab === 'guardrails') && (
          <WorkingHoursPanel />
        )}

        {(currentTab === 'users' || currentTab === 'roles') && <UsersRolesPanel />}

        {(currentTab === 'integrations' || currentTab === 'providers') && <IntegrationsPanel />}

        {(currentTab === 'security' || currentTab === 'storage' || currentTab === 'data_security') && (
          <StorageSecurityPanel />
        )}

        {currentTab === 'email-automation' && <EmailAutomationPanel />}
        </div>
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div
            id="deployToast"
            className="fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary text-primary-foreground shadow-lg border border-border z-50 text-[14px]"
          >
            <Icon name="check_circle" size={18} className="text-accent" />
            <span className="font-semibold">
              Settings saved and deployed successfully.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Settings Hub...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
