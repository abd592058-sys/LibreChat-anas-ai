import React, { useState } from 'react';
import { BookmarkPlus, SlidersHorizontal, X } from 'lucide-react';

type ParametersDrawerProps = {
  open: boolean;
  onClose: () => void;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  onChangeSystemPrompt: (val: string) => void;
  onChangeTemperature: (val: number) => void;
  onChangeTopP: (val: number) => void;
  onChangeMaxOutputTokens: (val: number) => void;
  onSavePreset: (title: string) => Promise<void>;
};

export const ParametersDrawer: React.FC<ParametersDrawerProps> = ({
  open,
  onClose,
  systemPrompt,
  temperature,
  topP,
  maxOutputTokens,
  onChangeSystemPrompt,
  onChangeTemperature,
  onChangeTopP,
  onChangeMaxOutputTokens,
  onSavePreset,
}) => {
  const [presetTitle, setPresetTitle] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetTitle.trim()) {
      return;
    }
    setSaving(true);
    try {
      await onSavePreset(presetTitle.trim());
      setPresetTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label="Conversation Parameters"
      className="bg-surface-alt border-theme flex h-full w-80 shrink-0 flex-col border-s"
    >
      <div className="border-theme flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-secondary h-4 w-4" />
          <h2 className="text-primary text-sm font-semibold">Parameters</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div>
          <label className="text-primary mb-1.5 block text-xs font-medium">
            System Instructions
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => onChangeSystemPrompt(e.target.value)}
            rows={5}
            placeholder="Custom system instructions for this conversation..."
            className="bg-surface border-theme-strong text-primary placeholder:text-tertiary w-full rounded-xl border p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-primary text-xs font-medium">Temperature</label>
            <span className="text-secondary font-mono text-xs">{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => onChangeTemperature(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-primary text-xs font-medium">Top P</label>
            <span className="text-secondary font-mono text-xs">{topP.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={topP}
            onChange={(e) => onChangeTopP(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-primary text-xs font-medium">Max Output Tokens</label>
            <span className="text-secondary font-mono text-xs">{maxOutputTokens}</span>
          </div>
          <input
            type="range"
            min={256}
            max={8192}
            step={256}
            value={maxOutputTokens}
            onChange={(e) => onChangeMaxOutputTokens(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>

        <form onSubmit={handleSave} className="border-theme border-t pt-4">
          <label className="text-primary mb-1.5 block text-xs font-medium">Save as Preset</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={presetTitle}
              onChange={(e) => setPresetTitle(e.target.value)}
              placeholder="Preset title..."
              className="bg-surface border-theme-strong text-primary placeholder:text-tertiary min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving || !presetTitle.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
