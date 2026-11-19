import React, { useState } from 'react';
import { Check, Code2, Copy, Download, Eye, X } from 'lucide-react';
import type { ArtifactData } from '~/types';

type ArtifactPanelProps = {
  artifact: ArtifactData;
  onClose: () => void;
};

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ artifact, onClose }) => {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const srcDoc =
    artifact.language === 'svg'
      ? `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#ffffff;">${artifact.code}</body></html>`
      : artifact.code;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const ext = artifact.language === 'svg' ? 'svg' : 'html';
    const blob = new Blob([artifact.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifact.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      aria-label="Code Artifact Preview"
      className="bg-surface-alt border-theme flex h-full w-full flex-col border-s md:w-[460px] lg:w-[540px] shrink-0"
    >
      <div className="border-theme flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500 uppercase">
            {artifact.language}
          </span>
          <h2 className="text-primary truncate text-sm font-medium">{artifact.title}</h2>
        </div>

        <div className="flex items-center gap-1">
          <div className="bg-surface-tertiary flex rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                tab === 'preview' ? 'bg-surface text-primary shadow-xs' : 'text-secondary hover:text-primary'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setTab('code')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                tab === 'code' ? 'bg-surface text-primary shadow-xs' : 'text-secondary hover:text-primary'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Code
            </button>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="Download file"
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close artifact panel"
            className="text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg p-1.5 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'preview' ? (
          <iframe
            title={artifact.title}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <pre className="text-primary p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap">
            <code>{artifact.code}</code>
          </pre>
        )}
      </div>
    </aside>
  );
};
