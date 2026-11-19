import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUp,
  Bot,
  Menu,
  Paperclip,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react';
import { api, streamChat } from '~/lib/api';
import type {
  Agent,
  ArtifactData,
  EndpointConfig,
  Message,
  MessageAttachment,
  Preset,
  PromptItem,
} from '~/types';
import { ArtifactPanel } from './ArtifactPanel';
import { MessageItem } from './MessageItem';
import { ModelSelector } from './ModelSelector';
import { ParametersDrawer } from './ParametersDrawer';

type ChatViewProps = {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  endpoints: EndpointConfig[];
  agents: Agent[];
  prompts: PromptItem[];
  presets: Preset[];
  onPresetsChanged: () => Promise<void>;
  onConversationsChanged: () => Promise<void>;
  initialAgentId?: string;
  initialPromptText?: string;
  onClearInitialPrompt?: () => void;
};

const QUICK_STARTERS = [
  {
    title: 'Interactive HTML Widget',
    prompt:
      'Build a clean, self-contained HTML artifact for a Pomodoro focus timer with start, pause, and reset controls.',
  },
  {
    title: 'Architecture Tradeoffs',
    prompt:
      'Compare Server-Sent Events vs WebSockets for streaming LLM tokens in production web apps.',
  },
  {
    title: 'Code Review Checklist',
    prompt:
      'Give me a practical security and reliability checklist for shipping a Node.js + Express REST API.',
  },
  {
    title: 'SVG Diagram',
    prompt:
      'Create a clean SVG architecture diagram illustrating a browser client talking to an Express API gateway and AI model backends.',
  },
];

export const ChatView: React.FC<ChatViewProps> = ({
  sidebarOpen,
  onOpenSidebar,
  endpoints,
  agents,
  prompts,
  presets,
  onPresetsChanged,
  onConversationsChanged,
  initialAgentId,
  initialPromptText,
  onClearInitialPrompt,
}) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedEndpoint, setSelectedEndpoint] = useState('google');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(initialAgentId);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [maxOutputTokens, setMaxOutputTokens] = useState(4096);

  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial agent/prompt when routed from Marketplace or Prompts
  useEffect(() => {
    if (initialAgentId) {
      const ag = agents.find((a) => a.id === initialAgentId);
      setSelectedAgentId(initialAgentId);
      if (ag) {
        setSelectedEndpoint(ag.provider);
        setSelectedModel(ag.model);
      }
    }
  }, [initialAgentId, agents]);

  useEffect(() => {
    if (initialPromptText) {
      setInput(initialPromptText);
      onClearInitialPrompt?.();
      textareaRef.current?.focus();
    }
  }, [initialPromptText, onClearInitialPrompt]);

  // Load conversation when conversationId param changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    setLoadingConvo(true);
    setErrorMsg(null);

    api
      .getConversation(conversationId)
      .then((res) => {
        if (cancelled) return;
        setMessages(res.messages);
        setSelectedEndpoint(res.conversation.endpoint || 'google');
        setSelectedModel(res.conversation.model || 'gemini-2.5-flash');
        setSelectedAgentId(res.conversation.agentId);
        if (typeof res.conversation.systemPrompt === 'string') {
          setSystemPrompt(res.conversation.systemPrompt);
        }
        if (typeof res.conversation.temperature === 'number') {
          setTemperature(res.conversation.temperature);
        }
        if (typeof res.conversation.topP === 'number') {
          setTopP(res.conversation.topP);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load conversation');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConvo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const slashSuggestions = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const term = input.slice(1).toLowerCase();
    if (term.includes(' ')) return [];
    return prompts.filter(
      (p) => p.command && (p.command.includes(term) || p.title.toLowerCase().includes(term)),
    );
  }, [input, prompts]);

  const activeAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) : undefined;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const loaded: MessageAttachment[] = [];
    for (const file of files.slice(0, 5)) {
      let content: string | undefined;
      if (
        file.type.startsWith('text/') ||
        /\.(txt|md|json|ts|tsx|js|jsx|py|css|html|svg|yaml|yml|csv)$/i.test(file.name)
      ) {
        content = await file.text().catch(() => undefined);
      }
      loaded.push({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content,
      });
    }
    setAttachments((prev) => [...prev, ...loaded]);
    e.target.value = '';
  };

  const runStream = async (opts: {
    text: string;
    regenerateFromMessageId?: string;
    editedMessageId?: string;
  }) => {
    if (isStreaming) return;
    setErrorMsg(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let createdConvoId = conversationId;
    let assistantMsgId = '';

    try {
      await streamChat(
        {
          conversationId,
          text: opts.text,
          endpoint: selectedEndpoint,
          model: selectedModel,
          agentId: selectedAgentId,
          systemPrompt: systemPrompt.trim() || undefined,
          temperature,
          topP,
          maxOutputTokens,
          attachments: attachments.length > 0 ? attachments : undefined,
          regenerateFromMessageId: opts.regenerateFromMessageId,
          editedMessageId: opts.editedMessageId,
        },
        {
          signal: controller.signal,
          onMeta: ({ conversation, userMessage, assistantMessageId }) => {
            createdConvoId = conversation.conversationId;
            assistantMsgId = assistantMessageId;
            setStreamingMessageId(assistantMessageId);

            const placeholderAssistant: Message = {
              messageId: assistantMessageId,
              conversationId: conversation.conversationId,
              parentMessageId: userMessage?.messageId ?? null,
              sender: activeAgent?.name || selectedModel,
              text: '',
              isCreatedByUser: false,
              model: selectedModel,
              endpoint: selectedEndpoint,
              agentId: selectedAgentId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            setMessages((prev) => {
              let base = prev;
              if (opts.editedMessageId) {
                const idx = prev.findIndex((m) => m.messageId === opts.editedMessageId);
                if (idx !== -1) base = prev.slice(0, idx);
              } else if (opts.regenerateFromMessageId) {
                const idx = prev.findIndex((m) => m.messageId === opts.regenerateFromMessageId);
                if (idx !== -1) base = prev.slice(0, idx);
              }
              return userMessage
                ? [...base, userMessage, placeholderAssistant]
                : [...base, placeholderAssistant];
            });
          },
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === assistantMsgId ? { ...m, text: `${m.text}${delta}` } : m,
              ),
            );
          },
          onDone: ({ conversation, assistantMessage }) => {
            setMessages((prev) =>
              prev.map((m) => (m.messageId === assistantMessage.messageId ? assistantMessage : m)),
            );
            onConversationsChanged();
            if (!conversationId && conversation.conversationId) {
              navigate(`/c/${conversation.conversationId}`, { replace: true });
            }
          },
        },
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg(err instanceof Error ? err.message : 'Streaming failed');
      }
      if (!conversationId && createdConvoId) {
        navigate(`/c/${createdConvoId}`, { replace: true });
      }
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
      abortRef.current = null;
      setAttachments([]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await runStream({ text: trimmed });
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Main chat column */}
      <div className="bg-canvas flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="border-theme flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={onOpenSidebar}
                title="Open sidebar"
                className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <ModelSelector
              endpoints={endpoints}
              agents={agents}
              presets={presets}
              selectedEndpoint={selectedEndpoint}
              selectedModel={selectedModel}
              selectedAgentId={selectedAgentId}
              onSelectModel={(ep, m) => {
                setSelectedEndpoint(ep);
                setSelectedModel(m);
              }}
              onSelectAgent={(agent) => {
                if (!agent) {
                  setSelectedAgentId(undefined);
                  return;
                }
                setSelectedAgentId(agent.id);
                setSelectedEndpoint(agent.provider);
                setSelectedModel(agent.model);
              }}
              onApplyPreset={(preset) => {
                setSelectedAgentId(undefined);
                setSelectedEndpoint(preset.endpoint);
                setSelectedModel(preset.model);
                if (preset.systemPrompt) setSystemPrompt(preset.systemPrompt);
                if (typeof preset.temperature === 'number') setTemperature(preset.temperature);
                if (typeof preset.topP === 'number') setTopP(preset.topP);
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setParamsOpen((v) => !v)}
            title="Conversation parameters"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
              paramsOpen
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                : 'border-theme text-secondary hover:text-primary hover:bg-surface-tertiary'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Parameters</span>
          </button>
        </header>

        {/* Transcript / Landing */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingConvo ? (
            <div className="text-secondary flex h-full items-center justify-center text-sm">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 py-10">
              {activeAgent ? (
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
                    <Bot className="h-7 w-7" />
                  </div>
                  <h1 className="text-primary text-2xl font-semibold">{activeAgent.name}</h1>
                  <p className="text-secondary mx-auto mt-2 max-w-lg text-sm">
                    {activeAgent.description}
                  </p>
                </div>
              ) : (
                <div className="mb-8 text-center">
                  <img
                    src="/assets/logo.svg"
                    alt="LibreChat"
                    className="mx-auto mb-4 h-12 w-12"
                  />
                  <h1 className="text-primary text-2xl font-semibold tracking-tight">
                    How can I help you today?
                  </h1>
                  <p className="text-secondary mt-1.5 text-sm">
                    Multi-model AI chat with Agents, Prompts, and interactive Code Artifacts
                  </p>
                </div>
              )}

              <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(activeAgent?.starters?.length
                  ? activeAgent.starters.map((s) => ({ title: 'Suggested Starter', prompt: s }))
                  : QUICK_STARTERS
                ).map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => runStream({ text: item.prompt })}
                    className="bg-surface-alt border-theme hover:border-theme-strong hover:bg-surface-tertiary/60 rounded-2xl border p-3.5 text-start transition"
                  >
                    <div className="text-primary text-xs font-semibold">{item.title}</div>
                    <div className="text-secondary mt-1 line-clamp-2 text-xs">{item.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-6">
              {messages.map((m) => (
                <MessageItem
                  key={m.messageId}
                  message={m}
                  endpoints={endpoints}
                  isStreaming={isStreaming && streamingMessageId === m.messageId}
                  onRegenerate={(msgId) =>
                    runStream({ text: '', regenerateFromMessageId: msgId })
                  }
                  onEditResubmit={(msgId, newText) =>
                    runStream({ text: newText, editedMessageId: msgId })
                  }
                  onOpenArtifact={(artifact) => {
                    setParamsOpen(false);
                    setActiveArtifact(artifact);
                  }}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4">
            <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-400">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="px-3 pb-4 pt-2 md:px-6">
          <div className="relative mx-auto max-w-3xl">
            {/* Slash prompt autocomplete */}
            {slashSuggestions.length > 0 && (
              <div className="bg-surface border-theme-strong absolute bottom-full start-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-2xl border shadow-xl">
                <div className="text-tertiary border-theme border-b px-3 py-1.5 text-[11px] font-semibold uppercase">
                  Prompt Commands
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {slashSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setInput(p.prompt);
                        textareaRef.current?.focus();
                      }}
                      className="hover:bg-surface-tertiary flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-xs transition"
                    >
                      <div className="min-w-0">
                        <div className="text-primary font-medium">{p.title}</div>
                        <div className="text-tertiary truncate">{p.oneliner}</div>
                      </div>
                      <span className="bg-surface-secondary text-secondary ms-2 shrink-0 rounded px-1.5 py-0.5 font-mono">
                        /{p.command}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-surface border-theme-strong focus-within:border-emerald-500/60 rounded-2xl border shadow-sm transition"
            >
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
                  {attachments.map((att) => (
                    <span
                      key={att.id}
                      className="bg-surface-secondary border-theme text-secondary inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                    >
                      <span className="max-w-[160px] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        }
                        className="hover:text-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={1}
                placeholder={`Message ${activeAgent?.name || selectedModel}... (type / for prompts)`}
                className="text-primary placeholder:text-tertiary max-h-48 w-full resize-none bg-transparent px-4 py-3 text-sm focus:outline-none"
              />

              <div className="flex items-center justify-between px-3 pb-2.5">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach text or code file"
                    className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                </div>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    title="Stop generating"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    title="Send message"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>

            <div className="text-tertiary mt-1.5 text-center text-[11px]">
              LibreChat can make mistakes. Verify important information.
            </div>
          </div>
        </div>
      </div>

      {/* Side panels */}
      {activeArtifact && (
        <ArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
      )}
      <ParametersDrawer
        open={paramsOpen && !activeArtifact}
        onClose={() => setParamsOpen(false)}
        systemPrompt={systemPrompt}
        temperature={temperature}
        topP={topP}
        maxOutputTokens={maxOutputTokens}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeTemperature={setTemperature}
        onChangeTopP={setTopP}
        onChangeMaxOutputTokens={setMaxOutputTokens}
        onSavePreset={async (title) => {
          await api.createPreset({
            title,
            endpoint: selectedEndpoint,
            model: selectedModel,
            systemPrompt: systemPrompt.trim() || undefined,
            temperature,
            topP,
          });
          await onPresetsChanged();
        }}
      />
    </div>
  );
};
