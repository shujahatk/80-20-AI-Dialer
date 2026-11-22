'use client';

import React, { useState } from 'react';
import type { AiAgent } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface PrimaryAgentSettingsProps {
  agent: AiAgent;
}

export const PrimaryAgentSettings: React.FC<PrimaryAgentSettingsProps> = ({ agent }) => {
  const [name, setName] = useState(agent.name);
  const [voice, setVoice] = useState('Rachel (Professional English / French)');
  const [personality, setPersonality] = useState('Consultative & Professional');
  const [openingMessage, setOpeningMessage] = useState(
    'Hello {{first_name}}, this is Rachel calling from RM Group regarding industrial raw materials and recycling pickups. Do you have a brief moment to discuss your monthly surplus volumes?'
  );
  const [callGoal, setCallGoal] = useState('Identify recyclable material volumes & schedule specialist consultation');
  const [questions, setQuestions] = useState<string[]>([
    'What types of surplus industrial or recyclable materials do you produce regularly?',
    'What is your approximate monthly volume or tonnage?',
    'Who is responsible for your site recycling and raw material contracts?',
  ]);
  const [newQuestion, setNewQuestion] = useState('');

  const [objections, setObjections] = useState([
    {
      trigger: 'We already have a recycling contractor',
      response: 'Understood. RM Group often works alongside existing contracts to provide backup logistics and better pricing on non-ferrous and specialized surplus. May we send our current price index?',
    },
    {
      trigger: 'Not interested at this time',
      response: 'Completely understand. When is your next contract review window so we can provide a competitive quote?',
    },
  ]);

  const [closingBehavior, setClosingBehavior] = useState(
    'When the prospect agrees to a consultation, confirm their email, schedule a 15-minute call with an RM technical representative, and send confirmation details.'
  );

  const [handoffRules, setHandoffRules] = useState(
    'Transfer call to human operator immediately if: (1) Prospect explicitly requests a live person, or (2) Urgent site hazardous evaluation is required.'
  );

  // Advanced AI settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are Rachel, an outbound commercial representative for RM Group (Recycling & Raw Materials). Maintain a polite, professional, and clear tone suitable for European enterprise clients.'
  );
  const [model, setModel] = useState('Claude 3.5 Sonnet');
  const [temperature, setTemperature] = useState(0.3);
  const [voiceStability, setVoiceStability] = useState(75);

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setQuestions((prev) => [...prev, newQuestion.trim()]);
    setNewQuestion('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Core Profile & Goal Card */}
      <div className="rounded-xl bg-surface p-6 flex flex-col gap-5 shadow-sm border border-border">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="person" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">
              Agent Identity &amp; Voice
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-success-surface text-success text-[12px] font-semibold border border-success/20">
            Active Persona
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px]">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-on-surface">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border text-[14px] focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-on-surface">AI Voice</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border text-[14px] focus:outline-none focus:border-primary"
            >
              <option value="Rachel (Professional English / French)">Rachel (Professional English / French)</option>
              <option value="George (Authoritative English)">George (Authoritative English)</option>
              <option value="Emma (Friendly Flemish / Dutch)">Emma (Friendly Flemish / Dutch)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-on-surface">Personality</label>
            <select
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border text-[14px] focus:outline-none focus:border-primary"
            >
              <option value="Consultative & Professional">Consultative &amp; Professional</option>
              <option value="Assertive & Direct">Assertive &amp; Direct</option>
              <option value="Empathetic & Supportive">Empathetic &amp; Supportive</option>
            </select>
          </div>
        </div>

        {/* Primary Call Goal */}
        <div className="flex flex-col gap-1.5 text-[14px]">
          <label className="font-semibold text-on-surface">Call Goal</label>
          <input
            type="text"
            value={callGoal}
            onChange={(e) => setCallGoal(e.target.value)}
            className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border text-[14px] focus:outline-none focus:border-primary"
          />
        </div>

        {/* Opening Message */}
        <div className="flex flex-col gap-1.5 text-[14px]">
          <label className="font-semibold text-on-surface">Opening Message</label>
          <textarea
            rows={3}
            value={openingMessage}
            onChange={(e) => setOpeningMessage(e.target.value)}
            className="bg-surface-secondary text-on-surface rounded-md p-3 border border-border text-[14px] leading-relaxed focus:outline-none focus:border-primary"
          />
          <span className="text-[12px] text-on-surface-variant">
            Supported fields: {'{{first_name}}'}, {'{{last_name}}'}, {'{{company}}'}
          </span>
        </div>
      </div>

      {/* 2. Questions to Ask */}
      <div className="rounded-xl bg-surface p-6 flex flex-col gap-4 shadow-sm border border-border">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="help_outline" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">
              Questions to Ask
            </h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">{questions.length} Questions</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {questions.map((q, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-secondary text-[14px] text-on-surface border border-border"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-[11px]">
                  {idx + 1}
                </span>
                <span>{q}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                className="text-on-surface-muted hover:text-error transition-colors"
                title="Remove question"
              >
                <Icon name="delete" size={18} />
              </button>
            </div>
          ))}

          <form onSubmit={handleAddQuestion} className="flex items-center gap-2 mt-2">
            <input
              type="text"
              placeholder="Add a new qualifying question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="flex-1 bg-surface-secondary text-[14px] text-on-surface placeholder:text-on-surface-muted rounded-md px-3 py-2 border border-border focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-hover transition-colors"
            >
              Add Question
            </button>
          </form>
        </div>
      </div>

      {/* 3. Objection Handling & Closing Behavior */}
      <div className="rounded-xl bg-surface p-6 flex flex-col gap-5 shadow-sm border border-border">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="forum" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">
              Objection Handling &amp; Closing Behavior
            </h2>
          </div>
        </div>

        {/* Objections List */}
        <div className="flex flex-col gap-3 text-[14px]">
          <span className="font-semibold text-on-surface">Objection Handling Rules</span>
          {objections.map((obj, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-surface-secondary flex flex-col gap-1.5 border border-border"
            >
              <span className="font-bold text-primary">When prospect states: &ldquo;{obj.trigger}&rdquo;</span>
              <p className="text-on-surface leading-relaxed text-[14px]">
                Response: &ldquo;{obj.response}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {/* Closing Behavior */}
        <div className="flex flex-col gap-1.5 text-[14px] pt-3 border-t border-border">
          <label className="font-semibold text-on-surface">Closing Behavior</label>
          <textarea
            rows={2}
            value={closingBehavior}
            onChange={(e) => setClosingBehavior(e.target.value)}
            className="bg-surface-secondary text-on-surface rounded-md p-3 border border-border text-[14px] leading-relaxed focus:outline-none focus:border-primary"
          />
        </div>

        {/* Handoff Rules */}
        <div className="flex flex-col gap-1.5 text-[14px]">
          <label className="font-semibold text-on-surface">Handoff Rules</label>
          <textarea
            rows={2}
            value={handoffRules}
            onChange={(e) => setHandoffRules(e.target.value)}
            className="bg-surface-secondary text-on-surface rounded-md p-3 border border-border text-[14px] leading-relaxed focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* 4. Advanced AI Settings */}
      <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 bg-surface-secondary hover:bg-surface-elevated transition-colors text-[14px] font-semibold text-on-surface"
        >
          <span className="flex items-center gap-2">
            <Icon name="tune" size={18} className="text-primary" />
            <span>Advanced AI Settings</span>
          </span>
          <Icon name={showAdvanced ? 'expand_less' : 'expand_more'} size={20} className="text-on-surface-variant" />
        </button>

        {showAdvanced && (
          <div className="p-6 flex flex-col gap-4 border-t border-border">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-on-surface">System Prompt</label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="bg-surface-secondary text-on-surface rounded-md p-3 border border-border text-[13px] font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">AI Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border"
                >
                  <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                  <option value="Claude 3.5 Haiku">Claude 3.5 Haiku</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Model Temperature ({temperature})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="accent-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Voice Stability ({voiceStability}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={voiceStability}
                  onChange={(e) => setVoiceStability(parseInt(e.target.value))}
                  className="accent-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => alert('Agent settings saved successfully.')}
          className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary font-semibold text-[14px] shadow-sm transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};
