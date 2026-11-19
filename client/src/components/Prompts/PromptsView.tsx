import React, { useState } from 'react';
import { BookOpen, Menu, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '~/lib/api';
import type { PromptItem } from '~/types';

type PromptsViewProps = {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  prompts: PromptItem[];
  onPromptsChanged: () => Promise<void>;
  onUsePrompt: (promptText: string) => void;
};

export const PromptsView: React.FC<PromptsViewProps> = ({
  sidebarOpen,
  onOpenSidebar,
  prompts,
  onPromptsChanged,
  onUsePrompt,
}) => {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [oneliner, setOneliner] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('general');
  const [promptBody, setPromptBody] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = prompts.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.oneliner.toLowerCase().includes(q) ||
      p.command.toLowerCase().includes(q)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptBody.trim()) return;
    setSaving(true);
    try {
      await api.createPrompt({
        title,
        oneliner,
        prompt: promptBody,
        category,
        command,
      });
      setTitle('');
      setOneliner('');
      setCommand('');
      setPromptBody('');
      setCreateOpen(false);
      await onPromptsChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-canvas flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="border-theme shrink-0 border-b px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="bg-surface border-theme flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2">
            <Search className="text-tertiary h-4 w-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts or /commands..."
              className="text-primary placeholder:text-tertiary w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            <span>New Prompt</span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-surface-alt border-theme flex flex-col rounded-2xl border p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-primary text-base font-semibold">{item.title}</h2>
                </div>
                {item.command && (
                  <span className="bg-surface-tertiary text-secondary rounded-md px-2 py-0.5 font-mono text-xs">
                    /{item.command}
                  </span>
                )}
              </div>

              {item.oneliner && (
                <p className="text-secondary mt-1.5 text-xs">{item.oneliner}</p>
              )}

              <pre className="bg-surface border-theme text-secondary mt-3 line-clamp-3 flex-1 rounded-xl border p-3 font-sans text-xs whitespace-pre-wrap">
                {item.prompt}
              </pre>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    await api.deletePrompt(item.id);
                    await onPromptsChanged();
                  }}
                  className="text-tertiary hover:text-red-400 rounded-lg p-1.5 transition"
                  title="Delete prompt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUsePrompt(item.prompt)}
                  className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Use in Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border-theme-strong w-full max-w-lg space-y-4 rounded-2xl border p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-primary text-lg font-semibold">Create Prompt Template</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-secondary hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-primary mb-1 block text-xs font-medium">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Unit Test Writer"
                  className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-primary mb-1 block text-xs font-medium">
                  Slash Command
                </label>
                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., tests"
                  className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-primary mb-1 block text-xs font-medium">Summary</label>
                <input
                  value={oneliner}
                  onChange={(e) => setOneliner(e.target.value)}
                  placeholder="Short description"
                  className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-primary mb-1 block text-xs font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="general">General</option>
                  <option value="coding">Coding</option>
                  <option value="research">Research</option>
                  <option value="productivity">Productivity</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-primary mb-1 block text-xs font-medium">Prompt Body</label>
              <textarea
                required
                rows={4}
                value={promptBody}
                onChange={(e) => setPromptBody(e.target.value)}
                placeholder="Write your reusable prompt template..."
                className="bg-surface-alt border-theme text-primary w-full rounded-xl border p-3 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="border-theme text-secondary rounded-xl border px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Prompt'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
