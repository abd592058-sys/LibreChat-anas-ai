import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, Sparkles, X } from 'lucide-react';
import type { Agent, EndpointConfig, Preset } from '~/types';

type ModelSelectorProps = {
  endpoints: EndpointConfig[];
  agents: Agent[];
  presets: Preset[];
  selectedEndpoint: string;
  selectedModel: string;
  selectedAgentId?: string;
  onSelectModel: (endpoint: string, model: string) => void;
  onSelectAgent: (agent: Agent | null) => void;
  onApplyPreset: (preset: Preset) => void;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  endpoints,
  agents,
  presets,
  selectedEndpoint,
  selectedModel,
  selectedAgentId,
  onSelectModel,
  onSelectAgent,
  onApplyPreset,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'models' | 'agents' | 'presets'>('models');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);
  const activeAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) : undefined;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface-tertiary border-theme flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition"
      >
        {activeAgent ? (
          <>
            <Bot className="h-4 w-4 text-emerald-500" />
            <span className="text-primary max-w-[160px] truncate">{activeAgent.name}</span>
          </>
        ) : (
          <>
            {currentEndpoint?.icon && (
              <img
                src={currentEndpoint.icon}
                alt={currentEndpoint.name}
                className="h-4 w-4 rounded-xs object-contain"
              />
            )}
            <span className="text-primary max-w-[180px] truncate">{selectedModel}</span>
          </>
        )}
        <ChevronDown className="text-secondary h-4 w-4" />
      </button>

      {activeAgent && (
        <button
          type="button"
          onClick={() => onSelectAgent(null)}
          title="Clear active agent"
          className="text-secondary hover:text-primary bg-surface-secondary border-theme inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
        >
          <span>Agent</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {open && (
        <div className="bg-surface border-theme-strong absolute start-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-2xl">
          <div className="border-theme flex border-b p-1.5 text-xs font-medium">
            {(['models', 'agents', 'presets'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 capitalize transition ${
                  tab === t ? 'bg-surface-tertiary text-primary' : 'text-secondary hover:text-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {tab === 'models' && (
              <div className="space-y-2.5">
                {endpoints.map((ep) => (
                  <div key={ep.id}>
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-2">
                        <img src={ep.icon} alt={ep.name} className="h-4 w-4 object-contain" />
                        <span className="text-secondary text-xs font-semibold">{ep.name}</span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          ep.configured
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-surface-tertiary text-tertiary'
                        }`}
                      >
                        {ep.configured ? 'Ready' : 'No key'}
                      </span>
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {ep.models.map((model) => {
                        const active =
                          !activeAgent && selectedEndpoint === ep.id && selectedModel === model;
                        return (
                          <button
                            key={model}
                            type="button"
                            onClick={() => {
                              onSelectAgent(null);
                              onSelectModel(ep.id, model);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-sm transition ${
                              active
                                ? 'bg-surface-tertiary text-primary font-medium'
                                : 'text-secondary hover:bg-surface-secondary hover:text-primary'
                            }`}
                          >
                            <span className="truncate">{model}</span>
                            {active && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'agents' && (
              <div className="space-y-1">
                {agents.map((agent) => {
                  const active = selectedAgentId === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        onSelectAgent(agent);
                        setOpen(false);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-start transition ${
                        active
                          ? 'bg-surface-tertiary text-primary'
                          : 'text-secondary hover:bg-surface-secondary hover:text-primary'
                      }`}
                    >
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <div className="text-primary truncate text-sm font-medium">{agent.name}</div>
                        <div className="text-tertiary truncate text-xs">{agent.model}</div>
                      </div>
                      {active && <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'presets' && (
              <div className="space-y-1">
                {presets.length === 0 ? (
                  <div className="text-tertiary py-6 text-center text-xs">
                    No saved presets yet. Save one from the parameters panel.
                  </div>
                ) : (
                  presets.map((preset) => (
                    <button
                      key={preset.presetId}
                      type="button"
                      onClick={() => {
                        onApplyPreset(preset);
                        setOpen(false);
                      }}
                      className="text-secondary hover:bg-surface-secondary hover:text-primary flex w-full items-center gap-2.5 rounded-xl p-2 text-start transition"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <div className="text-primary truncate text-sm font-medium">{preset.title}</div>
                        <div className="text-tertiary truncate text-xs">
                          {preset.endpoint} / {preset.model}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
