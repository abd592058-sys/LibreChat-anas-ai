import { GoogleGenAI } from '@google/genai';
import type { MessageRecord } from './store.ts';

export type StreamChatOptions = {
  endpoint: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  history: MessageRecord[];
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
};

export function getConfiguredProviders(): Record<string, boolean> {
  return {
    google: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_KEY),
    openAI: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
  };
}

function buildPlainMessages(history: MessageRecord[], systemPrompt?: string) {
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt?.trim()) {
    msgs.push({ role: 'system', content: systemPrompt.trim() });
  }
  for (const m of history) {
    let text = m.text;
    if (m.attachments && m.attachments.length > 0) {
      const filesText = m.attachments
        .map((att) =>
          att.content
            ? `\n\n[Attached file: ${att.name}]\n\`\`\`\n${att.content.slice(0, 24000)}\n\`\`\``
            : `\n\n[Attached file: ${att.name} (${att.size} bytes)]`,
        )
        .join('');
      text = `${text}${filesText}`;
    }
    msgs.push({
      role: m.isCreatedByUser ? 'user' : 'assistant',
      content: text,
    });
  }
  return msgs;
}

async function streamGemini(opts: StreamChatOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_KEY;
  if (!apiKey) {
    return streamMissingKeyNotice('Google Gemini', 'GEMINI_API_KEY', opts);
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents = opts.history.map((m) => {
    let text = m.text;
    if (m.attachments && m.attachments.length > 0) {
      const filesText = m.attachments
        .map((att) =>
          att.content
            ? `\n\n[Attached file: ${att.name}]\n\`\`\`\n${att.content.slice(0, 24000)}\n\`\`\``
            : `\n\n[Attached file: ${att.name}]`,
        )
        .join('');
      text = `${text}${filesText}`;
    }
    return {
      role: m.isCreatedByUser ? ('user' as const) : ('model' as const),
      parts: [{ text }],
    };
  });

  const response = await ai.models.generateContentStream({
    model: opts.model || 'gemini-2.5-flash',
    contents,
    config: {
      ...(opts.systemPrompt?.trim() ? { systemInstruction: opts.systemPrompt.trim() } : {}),
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(typeof opts.topP === 'number' ? { topP: opts.topP } : {}),
      ...(typeof opts.maxOutputTokens === 'number'
        ? { maxOutputTokens: opts.maxOutputTokens }
        : {}),
    },
  });

  let fullText = '';
  for await (const chunk of response) {
    if (opts.signal?.aborted) {
      break;
    }
    const delta = chunk.text ?? '';
    if (delta) {
      fullText += delta;
      opts.onChunk(delta);
    }
  }
  return fullText;
}

async function streamOpenAICompatible(
  baseUrl: string,
  apiKey: string | undefined,
  providerLabel: string,
  envVarName: string,
  opts: StreamChatOptions,
): Promise<string> {
  if (!apiKey) {
    return streamMissingKeyNotice(providerLabel, envVarName, opts);
  }

  const messages = buildPlainMessages(opts.history, opts.systemPrompt);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      stream: true,
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(typeof opts.topP === 'number' ? { top_p: opts.topP } : {}),
      ...(typeof opts.maxOutputTokens === 'number' ? { max_tokens: opts.maxOutputTokens } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`${providerLabel} API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        return fullText;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          opts.onChunk(delta);
        }
      } catch {
        // Ignore partial SSE lines
      }
    }
  }
  return fullText;
}

async function streamAnthropic(opts: StreamChatOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return streamMissingKeyNotice('Anthropic', 'ANTHROPIC_API_KEY', opts);
  }

  const messages = buildPlainMessages(opts.history).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model || 'claude-sonnet-4-20250514',
      max_tokens: opts.maxOutputTokens || 4096,
      stream: true,
      ...(opts.systemPrompt?.trim() ? { system: opts.systemPrompt.trim() } : {}),
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      try {
        const parsed = JSON.parse(data);
        if (parsed?.type === 'content_block_delta' && parsed?.delta?.text) {
          fullText += parsed.delta.text;
          opts.onChunk(parsed.delta.text);
        }
      } catch {
        // Ignore non-JSON SSE lines
      }
    }
  }
  return fullText;
}

async function streamMissingKeyNotice(
  providerLabel: string,
  envVarName: string,
  opts: StreamChatOptions,
): Promise<string> {
  const providers = getConfiguredProviders();
  const availableList = Object.entries(providers)
    .filter(([, enabled]) => enabled)
    .map(([name]) => `\`${name}\``)
    .join(', ');

  const message = [
    `### ${providerLabel} API Key Not Configured`,
    '',
    `No \`${envVarName}\` environment variable is set on the server for **${providerLabel}** (\`${opts.model}\`).`,
    '',
    availableList
      ? `Configured providers currently available on this server: ${availableList}. Switch to one of them in the model selector above, or add \`${envVarName}\` to your server environment.`
      : `Add \`${envVarName}=...\` (or \`GEMINI_API_KEY=...\`, \`OPENAI_API_KEY=...\`, \`ANTHROPIC_API_KEY=...\`) to your server environment and restart to enable live model responses.`,
  ].join('\n');

  const words = message.split(/(?<=\s)/);
  for (const word of words) {
    if (opts.signal?.aborted) {
      break;
    }
    opts.onChunk(word);
    await new Promise((r) => setTimeout(r, 12));
  }
  return message;
}

export async function streamChatCompletion(opts: StreamChatOptions): Promise<string> {
  switch (opts.endpoint) {
    case 'google':
      return streamGemini(opts);
    case 'openAI':
      return streamOpenAICompatible(
        'https://api.openai.com/v1',
        process.env.OPENAI_API_KEY,
        'OpenAI',
        'OPENAI_API_KEY',
        opts,
      );
    case 'deepseek':
      return streamOpenAICompatible(
        'https://api.deepseek.com/v1',
        process.env.DEEPSEEK_API_KEY,
        'DeepSeek',
        'DEEPSEEK_API_KEY',
        opts,
      );
    case 'groq':
      return streamOpenAICompatible(
        'https://api.groq.com/openai/v1',
        process.env.GROQ_API_KEY,
        'Groq',
        'GROQ_API_KEY',
        opts,
      );
    case 'anthropic':
      return streamAnthropic(opts);
    default:
      return streamGemini(opts);
  }
}
