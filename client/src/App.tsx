import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AgentsViewWrapper } from './RouteWrappers';
import { AccountModal } from './components/Auth/AccountModal';
import { ChatView } from './components/Chat/ChatView';
import { Sidebar } from './components/Nav/Sidebar';
import { PromptsView } from './components/Prompts/PromptsView';
import { api } from './lib/api';
import type { Agent, Conversation, EndpointConfig, Preset, PromptItem, User } from './types';

function resolveInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('color-theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // ignore
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const Shell: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const activeConversationId = params.conversationId;

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [theme, setTheme] = useState<'dark' | 'light'>(resolveInitialTheme);
  const [accountOpen, setAccountOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [queuedPromptText, setQueuedPromptText] = useState<string | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    try {
      localStorage.setItem('color-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const loadConversations = useCallback(async () => {
    const res = await api.getConversations(searchQuery);
    setConversations(res.conversations);
  }, [searchQuery]);

  const loadAll = useCallback(async () => {
    const [cfg, usr, convosRes, agentsRes, promptsRes, presetsRes] = await Promise.all([
      api.getConfig(),
      api.getUser(),
      api.getConversations(searchQuery),
      api.getAgents({ category: 'all' }),
      api.getPrompts(),
      api.getPresets(),
    ]);
    setEndpoints(cfg.endpoints);
    setUser(usr);
    setConversations(convosRes.conversations);
    setAgents(agentsRes.data);
    setPrompts(promptsRes.prompts);
    setPresets(presetsRes.presets);
  }, [searchQuery]);

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations().catch(() => {});
  }, [loadConversations]);

  const handleNewChat = () => {
    setSelectedAgentId(undefined);
    navigate('/');
  };

  const handleExportConversation = async (id: string) => {
    const data = await api.getConversation(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.conversation.title.replace(/[^a-z0-9-_]+/gi, '_') || 'conversation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-canvas text-primary flex h-full w-full overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewChat={handleNewChat}
        onRenameConversation={async (id, title) => {
          await api.updateConversation(id, { title });
          await loadConversations();
        }}
        onDeleteConversation={async (id) => {
          await api.deleteConversation(id);
          await loadConversations();
          if (activeConversationId === id) {
            navigate('/');
          }
        }}
        onBookmarkConversation={async (id, bookmarked) => {
          await api.updateConversation(id, { bookmarked });
          await loadConversations();
        }}
        onExportConversation={handleExportConversation}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        user={user}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <Routes>
        <Route
          path="/"
          element={
            <ChatView
              sidebarOpen={sidebarOpen}
              onOpenSidebar={() => setSidebarOpen(true)}
              endpoints={endpoints}
              agents={agents}
              prompts={prompts}
              presets={presets}
              onPresetsChanged={async () => {
                const res = await api.getPresets();
                setPresets(res.presets);
              }}
              onConversationsChanged={loadConversations}
              initialAgentId={selectedAgentId}
              initialPromptText={queuedPromptText}
              onClearInitialPrompt={() => setQueuedPromptText(undefined)}
            />
          }
        />
        <Route
          path="/c/:conversationId"
          element={
            <ChatView
              sidebarOpen={sidebarOpen}
              onOpenSidebar={() => setSidebarOpen(true)}
              endpoints={endpoints}
              agents={agents}
              prompts={prompts}
              presets={presets}
              onPresetsChanged={async () => {
                const res = await api.getPresets();
                setPresets(res.presets);
              }}
              onConversationsChanged={loadConversations}
            />
          }
        />
        <Route
          path="/agents"
          element={
            <AgentsViewWrapper
              sidebarOpen={sidebarOpen}
              onOpenSidebar={() => setSidebarOpen(true)}
              endpoints={endpoints}
              user={user}
              onStartAgentChat={(agent) => {
                setSelectedAgentId(agent.id);
                navigate('/');
              }}
              onAgentsChanged={async () => {
                const res = await api.getAgents({ category: 'all' });
                setAgents(res.data);
              }}
            />
          }
        />
        <Route
          path="/agents/:category"
          element={
            <AgentsViewWrapper
              sidebarOpen={sidebarOpen}
              onOpenSidebar={() => setSidebarOpen(true)}
              endpoints={endpoints}
              user={user}
              onStartAgentChat={(agent) => {
                setSelectedAgentId(agent.id);
                navigate('/');
              }}
              onAgentsChanged={async () => {
                const res = await api.getAgents({ category: 'all' });
                setAgents(res.data);
              }}
            />
          }
        />
        <Route
          path="/prompts"
          element={
            <PromptsView
              sidebarOpen={sidebarOpen}
              onOpenSidebar={() => setSidebarOpen(true)}
              prompts={prompts}
              onPromptsChanged={async () => {
                const res = await api.getPrompts();
                setPrompts(res.prompts);
              }}
              onUsePrompt={(promptText) => {
                setQueuedPromptText(promptText);
                navigate('/');
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AccountModal
        open={accountOpen}
        user={user}
        onClose={() => setAccountOpen(false)}
        onAuthChanged={loadAll}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/c/:conversationId" element={<Shell />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
