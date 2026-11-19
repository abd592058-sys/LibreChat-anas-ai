import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Check,
  Copy,
  Edit3,
  Eye,
  FileText,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import type { ArtifactData, EndpointConfig, Message } from '~/types';

type MessageItemProps = {
  message: Message;
  endpoints: EndpointConfig[];
  isStreaming?: boolean;
  onCopy?: (text: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditResubmit?: (messageId: string, newText: string) => void;
  onOpenArtifact?: (artifact: ArtifactData) => void;
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  endpoints,
  isStreaming = false,
  onRegenerate,
  onEditResubmit,
  onOpenArtifact,
}) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);

  const endpointMeta = endpoints.find((ep) => ep.id === message.endpoint);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    setEditing(false);
    onEditResubmit?.(message.messageId, trimmed);
  };

  return (
    <div
      className={`group px-4 py-5 md:px-6 ${
        message.isCreatedByUser ? '' : 'bg-surface-alt/40'
      }`}
    >
      <div className="mx-auto flex max-w-3xl gap-3.5 md:gap-4">
        {/* Avatar */}
        <div className="mt-0.5 shrink-0">
          {message.isCreatedByUser ? (
            <div className="bg-surface-tertiary border-theme flex h-8 w-8 items-center justify-center rounded-full border">
              <UserIcon className="text-secondary h-4 w-4" />
            </div>
          ) : endpointMeta?.icon ? (
            <div className="border-theme flex h-8 w-8 items-center justify-center rounded-full border bg-white p-1.5">
              <img
                src={endpointMeta.icon}
                alt={endpointMeta.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-primary text-sm font-semibold">
              {message.isCreatedByUser ? 'You' : message.sender || 'LibreChat'}
            </span>
            {!message.isCreatedByUser && message.model && (
              <span className="bg-surface-tertiary text-secondary rounded px-1.5 py-0.5 text-[11px] font-medium">
                {message.model}
              </span>
            )}
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {message.attachments.map((att) => (
                <span
                  key={att.id}
                  className="bg-surface-secondary border-theme text-secondary inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {att.name}
                </span>
              ))}
            </div>
          )}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="bg-surface border-theme-strong text-primary w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Save &amp; Submit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.text);
                    setEditing(false);
                  }}
                  className="border-theme text-secondary hover:text-primary rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="lc-markdown text-primary text-[15px]">
              {message.isCreatedByUser ? (
                <div className="whitespace-pre-wrap">{message.text}</div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeText = String(children).replace(/\n$/, '');
                      const isBlock = Boolean(match) || codeText.includes('\n');

                      if (!isBlock) {
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }

                      const lang = (match?.[1] || 'text').toLowerCase();
                      const isArtifact = lang === 'html' || lang === 'svg';

                      return (
                        <div className="border-theme my-3 overflow-hidden rounded-xl border bg-[#141414] text-neutral-100">
                          <div className="flex items-center justify-between border-b border-white/10 bg-[#1e1e1e] px-3.5 py-1.5 text-xs text-neutral-300">
                            <span className="font-mono uppercase">{lang}</span>
                            <div className="flex items-center gap-2">
                              {isArtifact && onOpenArtifact && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenArtifact({
                                      id: `${message.messageId}-${lang}`,
                                      title: `${lang.toUpperCase()} Artifact`,
                                      language: lang as 'html' | 'svg',
                                      code: codeText,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded bg-emerald-600/20 px-2 py-0.5 text-emerald-400 hover:bg-emerald-600/30"
                                >
                                  <Eye className="h-3 w-3" />
                                  Preview
                                </button>
                              )}
                              <CopyCodeButton code={codeText} />
                            </div>
                          </div>
                          <pre className="overflow-x-auto p-3.5 text-xs leading-relaxed font-mono">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    },
                  }}
                >
                  {message.text || (isStreaming ? 'Thinking...' : '')}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Action bar */}
          {!editing && !isStreaming && (
            <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy message"
                className="text-tertiary hover:text-primary hover:bg-surface-tertiary rounded-md p-1.5 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              {message.isCreatedByUser && onEditResubmit && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.text);
                    setEditing(true);
                  }}
                  title="Edit and resubmit"
                  className="text-tertiary hover:text-primary hover:bg-surface-tertiary rounded-md p-1.5 transition"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {!message.isCreatedByUser && onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(message.messageId)}
                  title="Regenerate response"
                  className="text-tertiary hover:text-primary hover:bg-surface-tertiary rounded-md p-1.5 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CopyCodeButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-neutral-300 hover:bg-white/10"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};
