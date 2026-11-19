import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  Compass,
  Download,
  Edit2,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Sun,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type { Conversation, User } from '~/types';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onBookmarkConversation: (id: string, bookmarked: boolean) => Promise<void>;
  onExportConversation: (id: string) => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user: User | null;
  onOpenAccount: () => void;
};

function groupConversationsByDate(convos: Conversation[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86400000;

  const groups: Array<{ label: string; items: Conversation[] }> = [
    { label: 'Bookmarked', items: [] },
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const c of convos) {
    if (c.bookmarked) {
      groups[0].items.push(c);
      continue;
    }
    const ts = new Date(c.updatedAt).getTime();
    if (ts >= startOfToday) {
      groups[1].items.push(c);
    } else if (ts >= startOfToday - oneDay) {
      groups[2].items.push(c);
    } else if (ts >= startOfToday - 7 * oneDay) {
      groups[3].items.push(c);
    } else {
      groups[4].items.push(c);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  conversations,
  activeConversationId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onBookmarkConversation,
  onExportConversation,
  theme,
  onToggleTheme,
  user,
  onOpenAccount,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const groups = useMemo(() => groupConversationsByDate(conversations), [conversations]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="bg-surface-secondary border-theme fixed inset-y-0 start-0 z-40 flex w-[268px] shrink-0 flex-col border-e md:static">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            title="Close sidebar"
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>

          <Link to="/" onClick={onNewChat} className="flex items-center gap-2">
            <img src="/assets/logo.svg" alt="LibreChat" className="h-6 w-6" />
            <span className="text-primary text-sm font-semibold tracking-tight">LibreChat</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              onNewChat();
              navigate('/');
            }}
            title="New chat"
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="space-y-1 px-2.5 pb-2">
          <Link
            to="/agents"
            onClick={() => {
              if (window.innerWidth < 768) onClose();
            }}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              location.pathname.startsWith('/agents')
                ? 'bg-surface-tertiary text-primary'
                : 'text-secondary hover:bg-surface-tertiary/60 hover:text-primary'
            }`}
          >
            <Compass className="h-4 w-4 text-emerald-500" />
            <span>Agent Marketplace</span>
          </Link>
          <Link
            to="/prompts"
            onClick={() => {
              if (window.innerWidth < 768) onClose();
            }}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              location.pathname.startsWith('/prompts')
                ? 'bg-surface-tertiary text-primary'
                : 'text-secondary hover:bg-surface-tertiary/60 hover:text-primary'
            }`}
          >
            <BookOpen className="h-4 w-4 text-emerald-500" />
            <span>Prompts Library</span>
          </Link>
        </div>

        {/* Search */}
        <div className="px-2.5 pb-2">
          <div className="bg-surface border-theme flex items-center gap-2 rounded-xl border px-2.5 py-1.5">
            <Search className="text-tertiary h-3.5 w-3.5 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="text-primary placeholder:text-tertiary w-full bg-transparent text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation history */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1">
          {groups.length === 0 ? (
            <div className="text-tertiary px-3 py-8 text-center text-xs">
              {searchQuery ? 'No matching conversations' : 'Your conversation history appears here'}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="text-tertiary px-2.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((convo) => {
                      const active = activeConversationId === convo.conversationId;
                      const isRenaming = renamingId === convo.conversationId;

                      return (
                        <div
                          key={convo.conversationId}
                          className={`group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition ${
                            active
                              ? 'bg-surface-tertiary text-primary font-medium'
                              : 'text-secondary hover:bg-surface-tertiary/60 hover:text-primary'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={async () => {
                                if (renameDraft.trim()) {
                                  await onRenameConversation(convo.conversationId, renameDraft.trim());
                                }
                                setRenamingId(null);
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  if (renameDraft.trim()) {
                                    await onRenameConversation(
                                      convo.conversationId,
                                      renameDraft.trim(),
                                    );
                                  }
                                  setRenamingId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingId(null);
                                }
                              }}
                              className="bg-surface text-primary min-w-0 flex-1 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                            />
                          ) : (
                            <Link
                              to={`/c/${convo.conversationId}`}
                              onClick={() => {
                                if (window.innerWidth < 768) onClose();
                              }}
                              className="min-w-0 flex-1 truncate text-[13px]"
                            >
                              {convo.title}
                            </Link>
                          )}

                          {!isRenaming && (
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                              <button
                                type="button"
                                title={convo.bookmarked ? 'Unbookmark' : 'Bookmark'}
                                onClick={() =>
                                  onBookmarkConversation(convo.conversationId, !convo.bookmarked)
                                }
                                className="hover:text-primary rounded p-1"
                              >
                                <Bookmark
                                  className={`h-3 w-3 ${
                                    convo.bookmarked ? 'fill-emerald-500 text-emerald-500' : ''
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                title="Rename"
                                onClick={() => {
                                  setRenamingId(convo.conversationId);
                                  setRenameDraft(convo.title);
                                }}
                                className="hover:text-primary rounded p-1"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Export JSON"
                                onClick={() => onExportConversation(convo.conversationId)}
                                className="hover:text-primary rounded p-1"
                              >
                                <Download className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => onDeleteConversation(convo.conversationId)}
                                className="rounded p-1 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-theme flex items-center justify-between gap-2 border-t p-2.5">
          <button
            type="button"
            onClick={onOpenAccount}
            className="hover:bg-surface-tertiary flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition"
          >
            <div className="bg-surface-tertiary border-theme flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
              <UserIcon className="text-primary h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-primary truncate text-xs font-medium">
                {user?.name || 'Workspace User'}
              </div>
              <div className="text-tertiary truncate text-[11px]">
                {user?.email || 'Local session'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-xl p-2 transition"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
