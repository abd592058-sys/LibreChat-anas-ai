import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Bot, Menu, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '~/lib/api';
import type { Agent, AgentCategory, EndpointConfig, User } from '~/types';

type MarketplaceViewProps = {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  endpoints: EndpointConfig[];
  user: User | null;
  onStartAgentChat: (agent: Agent) => void;
  onAgentsChanged: () => Promise<void>;
};

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  sidebarOpen,
  onOpenSidebar,
  endpoints,
  user,
  onStartAgentChat,
  onAgentsChanged,
}) => {
  const { category } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const searchQuery = searchParams.get('q') || '';
  const mine = searchParams.get('mine') === '1';
  const sort = searchParams.get('sort') || 'popular';
  const activeCategory = category || (mine ? 'all' : 'promoted');

  useEffect(() => {
    api.getAgentCategories().then(setCategories).catch(() => {});
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await api.getAgents({
        category: activeCategory,
        q: searchQuery,
        mine,
        sort,
      });
      setAgents(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, [activeCategory, searchQuery, mine, sort]);

  return (
    <div className="bg-canvas flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-theme shrink-0 border-b px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
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
              value={searchQuery}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value.trim()) next.set('q', e.target.value);
                else next.delete('q');
                setSearchParams(next);
              }}
              placeholder="Search agents by name, skill, or category..."
              className="text-primary placeholder:text-tertiary w-full bg-transparent text-sm focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            <span>Create Agent</span>
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const active = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() =>
                    navigate({
                      pathname:
                        cat.value === 'promoted'
                          ? '/agents'
                          : `/agents/${encodeURIComponent(cat.value)}`,
                      search: searchParams.toString(),
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-surface-tertiary text-primary'
                      : 'text-secondary hover:bg-surface-secondary hover:text-primary'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (mine) next.delete('mine');
                else next.set('mine', '1');
                setSearchParams(next);
              }}
              className={`border-theme rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                mine
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              My Agents
            </button>

            <select
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                next.set('sort', e.target.value);
                setSearchParams(next);
              }}
              className="bg-surface border-theme text-primary rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value="popular">Top Picks</option>
              <option value="newest">Newest</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-surface-alt border-theme h-56 animate-pulse rounded-2xl border"
                />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-secondary py-20 text-center text-sm">
              No agents match your current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <article
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="bg-surface-alt border-theme hover:border-theme-strong group flex cursor-pointer flex-col rounded-2xl border p-5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                      <Bot className="h-5 w-5" />
                    </div>
                    <span className="bg-surface-tertiary text-secondary rounded-md px-2 py-0.5 text-[11px] font-medium capitalize">
                      {agent.category}
                    </span>
                  </div>

                  <h2 className="text-primary mt-4 text-base font-semibold">{agent.name}</h2>
                  <p className="text-secondary mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed">
                    {agent.description || 'Custom LibreChat agent'}
                  </p>

                  <footer className="border-theme mt-4 flex items-center justify-between border-t pt-3 text-xs">
                    <span className="text-tertiary">By {agent.authorName}</span>
                    <span className="text-primary inline-flex items-center gap-1 font-medium group-hover:text-emerald-500">
                      View Details
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedAgent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border-theme-strong w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-primary text-lg font-semibold">{selectedAgent.name}</h2>
                  <div className="text-tertiary text-xs">
                    {selectedAgent.provider} · {selectedAgent.model} · By {selectedAgent.authorName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="text-secondary hover:text-primary rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-secondary mt-4 text-sm leading-relaxed">
              {selectedAgent.description}
            </p>

            {selectedAgent.instructions && (
              <div className="bg-surface-alt border-theme mt-4 rounded-xl border p-3">
                <div className="text-tertiary mb-1 text-[11px] font-semibold uppercase">
                  System Instructions
                </div>
                <p className="text-primary text-xs leading-relaxed">
                  {selectedAgent.instructions}
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              {selectedAgent.authorId === user?.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    await api.deleteAgent(selectedAgent.id);
                    setSelectedAgent(null);
                    await Promise.all([loadAgents(), onAgentsChanged()]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  const target = selectedAgent;
                  setSelectedAgent(null);
                  onStartAgentChat(target);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Start Chat with Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {createOpen && (
        <CreateAgentModal
          endpoints={endpoints}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await Promise.all([loadAgents(), onAgentsChanged()]);
          }}
        />
      )}
    </div>
  );
};

const CreateAgentModal: React.FC<{
  endpoints: EndpointConfig[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}> = ({ endpoints, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('general');
  const [provider, setProvider] = useState(endpoints[0]?.id || 'google');
  const [model, setModel] = useState(endpoints[0]?.models[0] || 'gemini-2.5-flash');
  const [saving, setSaving] = useState(false);

  const selectedEp = endpoints.find((e) => e.id === provider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createAgent({
        name,
        description,
        instructions,
        category,
        provider,
        model,
      });
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-theme-strong w-full max-w-lg space-y-4 rounded-2xl border p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-primary text-lg font-semibold">Create Custom Agent</h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="text-primary mb-1 block text-xs font-medium">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Security Auditor"
            className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="text-primary mb-1 block text-xs font-medium">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent specialize in?"
            className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-primary mb-1 block text-xs font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-2.5 py-2 text-xs"
            >
              <option value="general">General</option>
              <option value="coding">Coding</option>
              <option value="research">Research</option>
              <option value="writing">Writing</option>
              <option value="productivity">Productivity</option>
            </select>
          </div>

          <div>
            <label className="text-primary mb-1 block text-xs font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                const nextEp = endpoints.find((ep) => ep.id === e.target.value);
                setProvider(e.target.value);
                if (nextEp?.models[0]) setModel(nextEp.models[0]);
              }}
              className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-2.5 py-2 text-xs"
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-primary mb-1 block text-xs font-medium">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-2.5 py-2 text-xs"
            >
              {(selectedEp?.models ?? [model]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-primary mb-1 block text-xs font-medium">System Instructions</label>
          <textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Define persona, tone, constraints, and formatting rules..."
            className="bg-surface-alt border-theme text-primary w-full rounded-xl border p-3 text-sm focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border-theme text-secondary rounded-xl border px-4 py-2 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
};
