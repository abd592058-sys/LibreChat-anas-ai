import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import {
  store,
  AGENT_CATEGORIES,
  ENDPOINT_CATALOG,
  type ConversationRecord,
  type MessageRecord,
} from './server/store.ts';
import { getConfiguredProviders, streamChatCompletion } from './server/ai.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'librechat-dev-secret-change-in-prod';
const AUTH_COOKIE = 'librechat_token';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

function resolveUser(req: express.Request) {
  const token =
    req.cookies?.[AUTH_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
      if (decoded?.userId && store.users.has(decoded.userId)) {
        return store.users.get(decoded.userId)!;
      }
    } catch {
      // Invalid or expired token falls back to workspace user
    }
  }
  return store.users.get('local-user')!;
}

function setAuthCookie(res: express.Response, userId: string) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.8.9' });
});

// Startup config
app.get('/api/config', (_req, res) => {
  const configured = getConfiguredProviders();
  res.json({
    appTitle: process.env.APP_TITLE || 'LibreChat',
    version: '0.8.9',
    registrationEnabled: true,
    emailLoginEnabled: true,
    configuredProviders: configured,
    endpoints: ENDPOINT_CATALOG.map((ep) => ({
      ...ep,
      configured: Boolean(configured[ep.id]),
    })),
  });
});

app.get('/api/endpoints', (_req, res) => {
  const configured = getConfiguredProviders();
  res.json(
    ENDPOINT_CATALOG.map((ep) => ({
      ...ep,
      configured: Boolean(configured[ep.id]),
    })),
  );
});

app.get('/api/models', (_req, res) => {
  const models: Record<string, string[]> = {};
  for (const ep of ENDPOINT_CATALOG) {
    models[ep.id] = ep.models;
  }
  res.json(models);
});

// Auth endpoints
app.get('/api/user', (req, res) => {
  const user = resolveUser(req);
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!email || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Valid email and password (min 6 chars) required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (store.usersByEmail.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: nanoid(12),
    name: String(name || normalizedEmail.split('@')[0]).trim(),
    username: normalizedEmail.split('@')[0],
    email: normalizedEmail,
    passwordHash,
    role: 'USER' as const,
    createdAt: new Date().toISOString(),
  };
  store.users.set(user.id, user);
  store.usersByEmail.set(user.email, user);
  setAuthCookie(res, user.id);
  return res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const user = store.usersByEmail.get(normalizedEmail);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  setAuthCookie(res, user.id);
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

// Conversations
app.get('/api/convos', (req, res) => {
  const user = resolveUser(req);
  const search = String(req.query.search || '')
    .trim()
    .toLowerCase();
  const list = Array.from(store.conversations.values())
    .filter((c) => c.userId === user.id)
    .filter((c) => {
      if (!search) {
        return true;
      }
      if (c.title.toLowerCase().includes(search)) {
        return true;
      }
      const msgs = store.messages.get(c.conversationId) ?? [];
      return msgs.some((m) => m.text.toLowerCase().includes(search));
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json({ conversations: list });
});

app.get('/api/convos/:conversationId', (req, res) => {
  const user = resolveUser(req);
  const convo = store.conversations.get(req.params.conversationId);
  if (!convo || convo.userId !== user.id) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const messages = store.messages.get(convo.conversationId) ?? [];
  return res.json({ conversation: convo, messages });
});

app.patch('/api/convos/:conversationId', (req, res) => {
  const user = resolveUser(req);
  const convo = store.conversations.get(req.params.conversationId);
  if (!convo || convo.userId !== user.id) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const { title, bookmarked, endpoint, model, systemPrompt, temperature, topP, agentId } =
    req.body ?? {};
  if (typeof title === 'string' && title.trim()) {
    convo.title = title.trim();
  }
  if (typeof bookmarked === 'boolean') {
    convo.bookmarked = bookmarked;
  }
  if (typeof endpoint === 'string') {
    convo.endpoint = endpoint;
  }
  if (typeof model === 'string') {
    convo.model = model;
  }
  if (typeof systemPrompt === 'string') {
    convo.systemPrompt = systemPrompt;
  }
  if (typeof temperature === 'number') {
    convo.temperature = temperature;
  }
  if (typeof topP === 'number') {
    convo.topP = topP;
  }
  if (agentId !== undefined) {
    convo.agentId = agentId || undefined;
  }
  convo.updatedAt = new Date().toISOString();
  store.conversations.set(convo.conversationId, convo);
  return res.json({ conversation: convo });
});

app.delete('/api/convos/:conversationId', (req, res) => {
  const user = resolveUser(req);
  const convo = store.conversations.get(req.params.conversationId);
  if (!convo || convo.userId !== user.id) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  store.conversations.delete(convo.conversationId);
  store.messages.delete(convo.conversationId);
  return res.json({ deleted: true });
});

app.delete('/api/convos', (req, res) => {
  const user = resolveUser(req);
  for (const [id, convo] of store.conversations.entries()) {
    if (convo.userId === user.id) {
      store.conversations.delete(id);
      store.messages.delete(id);
    }
  }
  return res.json({ cleared: true });
});

// Messages
app.get('/api/messages/:conversationId', (req, res) => {
  const user = resolveUser(req);
  const convo = store.conversations.get(req.params.conversationId);
  if (!convo || convo.userId !== user.id) {
    return res.json({ messages: [] });
  }
  return res.json({ messages: store.messages.get(convo.conversationId) ?? [] });
});

app.patch('/api/messages/:conversationId/:messageId', (req, res) => {
  const user = resolveUser(req);
  const convo = store.conversations.get(req.params.conversationId);
  if (!convo || convo.userId !== user.id) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const list = store.messages.get(convo.conversationId) ?? [];
  const msg = list.find((m) => m.messageId === req.params.messageId);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }
  if (typeof req.body?.text === 'string') {
    msg.text = req.body.text;
    msg.updatedAt = new Date().toISOString();
  }
  return res.json({ message: msg });
});

// SSE Chat endpoint
app.post('/api/chat', async (req, res) => {
  const user = resolveUser(req);
  const {
    conversationId: incomingConvoId,
    text,
    endpoint = 'google',
    model = 'gemini-2.5-flash',
    agentId,
    systemPrompt,
    temperature,
    topP,
    maxOutputTokens,
    attachments,
    regenerateFromMessageId,
    editedMessageId,
  } = req.body ?? {};

  if (!text && !regenerateFromMessageId) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  const nowIso = new Date().toISOString();
  const convoId = incomingConvoId || nanoid(14);
  let convo: ConversationRecord | undefined = store.conversations.get(convoId);

  const selectedAgent = agentId ? store.agents.get(agentId) : undefined;
  const effectiveEndpoint = selectedAgent?.provider || endpoint;
  const effectiveModel = selectedAgent?.model || model;
  const effectiveSystemPrompt =
    [selectedAgent?.instructions, systemPrompt].filter(Boolean).join('\n\n') || undefined;

  if (!convo) {
    const rawTitle = String(text || selectedAgent?.name || 'New Chat').trim();
    const title = rawTitle.length > 48 ? `${rawTitle.slice(0, 48)}...` : rawTitle;
    convo = {
      conversationId: convoId,
      userId: user.id,
      title: title || 'New Chat',
      endpoint: effectiveEndpoint,
      model: effectiveModel,
      agentId: selectedAgent?.id,
      systemPrompt: effectiveSystemPrompt,
      temperature,
      topP,
      maxOutputTokens,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.conversations.set(convoId, convo);
  } else {
    convo.endpoint = effectiveEndpoint;
    convo.model = effectiveModel;
    convo.agentId = selectedAgent?.id;
    convo.updatedAt = nowIso;
    store.conversations.set(convoId, convo);
  }

  let history = [...(store.messages.get(convoId) ?? [])];

  if (editedMessageId) {
    const idx = history.findIndex((m) => m.messageId === editedMessageId);
    if (idx !== -1) {
      history = history.slice(0, idx);
    }
  } else if (regenerateFromMessageId) {
    const idx = history.findIndex((m) => m.messageId === regenerateFromMessageId);
    if (idx !== -1) {
      history = history.slice(0, idx);
    }
  }

  let userMessage: MessageRecord | null = null;
  if (!regenerateFromMessageId) {
    const parentId = history.length > 0 ? history[history.length - 1].messageId : null;
    userMessage = {
      messageId: nanoid(12),
      conversationId: convoId,
      parentMessageId: parentId,
      sender: user.name,
      text: String(text || ''),
      isCreatedByUser: true,
      attachments: Array.isArray(attachments) ? attachments : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    history.push(userMessage);
    store.messages.set(convoId, history);
  }

  // Setup SSE stream
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  const assistantMessageId = nanoid(12);
  const sendEvent = (payload: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  sendEvent({
    type: 'meta',
    conversation: convo,
    userMessage,
    assistantMessageId,
  });

  let assistantText = '';
  let hasError = false;

  try {
    assistantText = await streamChatCompletion({
      endpoint: effectiveEndpoint,
      model: effectiveModel,
      systemPrompt: effectiveSystemPrompt,
      temperature: typeof temperature === 'number' ? temperature : convo.temperature,
      topP: typeof topP === 'number' ? topP : convo.topP,
      maxOutputTokens:
        typeof maxOutputTokens === 'number' ? maxOutputTokens : convo.maxOutputTokens,
      history,
      signal: abortController.signal,
      onChunk: (delta) => {
        sendEvent({ type: 'delta', text: delta });
      },
    });
  } catch (err) {
    hasError = true;
    const message = err instanceof Error ? err.message : 'Unexpected model streaming error';
    assistantText = assistantText
      ? `${assistantText}\n\n[Error: ${message}]`
      : `**Error:** ${message}`;
    sendEvent({ type: 'delta', text: assistantText });
  }

  const finalTimestamp = new Date().toISOString();
  const assistantMessage: MessageRecord = {
    messageId: assistantMessageId,
    conversationId: convoId,
    parentMessageId: history.length > 0 ? history[history.length - 1].messageId : null,
    sender: selectedAgent?.name || effectiveModel,
    text: assistantText || '(No response generated)',
    isCreatedByUser: false,
    model: effectiveModel,
    endpoint: effectiveEndpoint,
    agentId: selectedAgent?.id,
    error: hasError,
    createdAt: finalTimestamp,
    updatedAt: finalTimestamp,
  };

  const finalHistory = [...history, assistantMessage];
  store.messages.set(convoId, finalHistory);
  convo.updatedAt = finalTimestamp;
  store.conversations.set(convoId, convo);

  sendEvent({
    type: 'done',
    conversation: convo,
    assistantMessage,
  });
  res.end();
  return;
});

// Agents & Marketplace
app.get('/api/agents/categories', (_req, res) => {
  res.json(AGENT_CATEGORIES);
});

app.get('/api/agents', (req, res) => {
  const user = resolveUser(req);
  const category = String(req.query.category || 'all');
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const mine = req.query.mine === '1';
  const sort = String(req.query.sort || 'popular');

  let list = Array.from(store.agents.values()).filter((a) => a.isPublic || a.authorId === user.id);

  if (mine) {
    list = list.filter((a) => a.authorId === user.id);
  }
  if (category === 'promoted') {
    list = list.filter((a) => a.promoted);
  } else if (category && category !== 'all') {
    list = list.filter((a) => a.category === category);
  }
  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }
  if (sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'newest') {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    list.sort((a, b) => Number(Boolean(b.promoted)) - Number(Boolean(a.promoted)));
  }

  res.json({ data: list });
});

app.post('/api/agents', (req, res) => {
  const user = resolveUser(req);
  const { name, description, instructions, category, provider, model, starters } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Agent name is required.' });
  }
  const nowIso = new Date().toISOString();
  const agent = {
    id: `agent-${nanoid(10)}`,
    name: String(name).trim(),
    description: String(description || '').trim(),
    instructions: String(instructions || '').trim(),
    category: String(category || 'general'),
    provider: String(provider || 'google'),
    model: String(model || 'gemini-2.5-flash'),
    authorName: user.name,
    authorId: user.id,
    isPublic: true,
    promoted: false,
    tools: ['artifacts'],
    starters: Array.isArray(starters) ? starters.filter(Boolean) : [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.agents.set(agent.id, agent);
  return res.status(201).json({ agent });
});

app.delete('/api/agents/:id', (req, res) => {
  const user = resolveUser(req);
  const agent = store.agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  if (agent.authorId !== user.id && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  store.agents.delete(agent.id);
  return res.json({ deleted: true });
});

// Prompts Library
app.get('/api/prompts', (req, res) => {
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const list = Array.from(store.prompts.values())
    .filter((p) => {
      if (!q) {
        return true;
      }
      return (
        p.title.toLowerCase().includes(q) ||
        p.oneliner.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json({ prompts: list });
});

app.post('/api/prompts', (req, res) => {
  const user = resolveUser(req);
  const { title, oneliner, prompt, category, command } = req.body ?? {};
  if (!title?.trim() || !prompt?.trim()) {
    return res.status(400).json({ error: 'Title and prompt text are required.' });
  }
  const nowIso = new Date().toISOString();
  const item = {
    id: nanoid(10),
    title: String(title).trim(),
    oneliner: String(oneliner || '').trim(),
    prompt: String(prompt),
    category: String(category || 'general'),
    command: String(command || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, ''),
    authorId: user.id,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.prompts.set(item.id, item);
  return res.status(201).json({ prompt: item });
});

app.delete('/api/prompts/:id', (req, res) => {
  if (!store.prompts.has(req.params.id)) {
    return res.status(404).json({ error: 'Prompt not found' });
  }
  store.prompts.delete(req.params.id);
  return res.json({ deleted: true });
});

// Presets
app.get('/api/presets', (req, res) => {
  const user = resolveUser(req);
  const list = Array.from(store.presets.values()).filter(
    (p) => p.userId === user.id || p.userId === 'local-user',
  );
  res.json({ presets: list });
});

app.post('/api/presets', (req, res) => {
  const user = resolveUser(req);
  const { title, endpoint, model, systemPrompt, temperature, topP } = req.body ?? {};
  if (!title?.trim()) {
    return res.status(400).json({ error: 'Preset title is required.' });
  }
  const preset = {
    presetId: `preset-${nanoid(8)}`,
    userId: user.id,
    title: String(title).trim(),
    endpoint: String(endpoint || 'google'),
    model: String(model || 'gemini-2.5-flash'),
    systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : undefined,
    temperature: typeof temperature === 'number' ? temperature : undefined,
    topP: typeof topP === 'number' ? topP : undefined,
    createdAt: new Date().toISOString(),
  };
  store.presets.set(preset.presetId, preset);
  return res.status(201).json({ preset });
});

app.delete('/api/presets/:presetId', (req, res) => {
  store.presets.delete(req.params.presetId);
  return res.json({ deleted: true });
});

// Parse optional CLI flags (e.g. --port 3000 --host 0.0.0.0)
function getCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

// Vite dev middleware or static production build
async function start() {
  const listenPort = Number(getCliArg('--port')) || PORT;
  const listenHost = getCliArg('--host') || HOST;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const viteReady = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        configFile: path.resolve(__dirname, 'vite.config.ts'),
        server: { middlewareMode: true, hmr: false, ws: false },
        appType: 'spa',
      }),
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await viteReady;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(listenPort, listenHost, () => {
    console.log(`LibreChat server listening on http://${listenHost}:${listenPort}`);
  });
}

start().catch((err) => {
  console.error('Failed to start LibreChat server:', err);
  process.exit(1);
});
