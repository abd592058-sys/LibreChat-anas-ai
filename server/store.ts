import { nanoid } from 'nanoid';

export type Role = 'ADMIN' | 'USER';

export type UserRecord = {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  avatar?: string;
  createdAt: string;
};

export type MessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
};

export type MessageRecord = {
  messageId: string;
  conversationId: string;
  parentMessageId: string | null;
  sender: string;
  text: string;
  isCreatedByUser: boolean;
  model?: string;
  endpoint?: string;
  agentId?: string;
  error?: boolean;
  attachments?: MessageAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type ConversationRecord = {
  conversationId: string;
  userId: string;
  title: string;
  endpoint: string;
  model: string;
  agentId?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  bookmarked?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentRecord = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  provider: string;
  model: string;
  authorName: string;
  authorId: string;
  isPublic: boolean;
  promoted?: boolean;
  tools: string[];
  starters: string[];
  createdAt: string;
  updatedAt: string;
};

export type PromptRecord = {
  id: string;
  title: string;
  oneliner: string;
  prompt: string;
  category: string;
  command: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
};

export type PresetRecord = {
  presetId: string;
  userId: string;
  title: string;
  endpoint: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  createdAt: string;
};

export const AGENT_CATEGORIES = [
  { value: 'promoted', label: 'Top Picks' },
  { value: 'all', label: 'All' },
  { value: 'coding', label: 'Coding' },
  { value: 'research', label: 'Research' },
  { value: 'writing', label: 'Writing' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'general', label: 'General' },
];

export const ENDPOINT_CATALOG = [
  {
    id: 'google',
    name: 'Google',
    icon: '/assets/google.svg',
    envKey: 'GEMINI_API_KEY',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'openAI',
    name: 'OpenAI',
    icon: '/assets/openai.svg',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '/assets/openrouter.png',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '/assets/deepseek.svg',
    envKey: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: '/assets/groq.png',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
];

const now = () => new Date().toISOString();

class MemoryStore {
  users = new Map<string, UserRecord>();
  usersByEmail = new Map<string, UserRecord>();
  conversations = new Map<string, ConversationRecord>();
  messages = new Map<string, MessageRecord[]>();
  agents = new Map<string, AgentRecord>();
  prompts = new Map<string, PromptRecord>();
  presets = new Map<string, PresetRecord>();

  constructor() {
    this.seed();
  }

  private seed() {
    const defaultUser: UserRecord = {
      id: 'local-user',
      name: 'Workspace User',
      username: 'workspace',
      email: 'user@librechat.local',
      passwordHash: '',
      role: 'ADMIN',
      createdAt: now(),
    };
    this.users.set(defaultUser.id, defaultUser);
    this.usersByEmail.set(defaultUser.email, defaultUser);

    const seedAgents: AgentRecord[] = [
      {
        id: 'agent-librechat-assistant',
        name: 'LibreChat Assistant',
        description:
          'General-purpose AI assistant tuned for clear reasoning, structured formatting, and everyday problem solving.',
        instructions:
          'You are LibreChat Assistant, a helpful, accurate, and concise AI assistant. Format responses with clean Markdown when helpful.',
        category: 'general',
        provider: 'google',
        model: 'gemini-2.5-flash',
        authorName: 'LibreChat',
        authorId: 'system',
        isPublic: true,
        promoted: true,
        tools: ['artifacts', 'markdown'],
        starters: [
          'Compare REST vs GraphQL for a high-throughput mobile API',
          'Summarize the key principles of clean system architecture',
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'agent-code-architect',
        name: 'Code & Artifacts Builder',
        description:
          'Full-stack software engineer specializing in TypeScript, React, HTML/SVG interactive prototypes, and clean code architecture.',
        instructions:
          'You are an expert senior software engineer. When the user asks for an interactive UI widget, diagram, or web component, output clean, self-contained HTML or SVG fenced code blocks (```html or ```svg) so they can be previewed directly in the Artifacts panel.',
        category: 'coding',
        provider: 'google',
        model: 'gemini-2.5-pro',
        authorName: 'LibreChat',
        authorId: 'system',
        isPublic: true,
        promoted: true,
        tools: ['code', 'artifacts'],
        starters: [
          'Build a self-contained HTML interactive Pomodoro timer widget',
          'Design a TypeScript rate-limiter middleware using a token bucket',
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'agent-research-analyst',
        name: 'Research & Synthesis Analyst',
        description:
          'Breaks down complex technical papers, tradeoffs, and market landscapes into structured executive briefs.',
        instructions:
          'You are a rigorous research analyst. Present balanced perspectives, explicitly separate established facts from assumptions, and organize findings with clear headings and comparison tables.',
        category: 'research',
        provider: 'google',
        model: 'gemini-2.5-flash',
        authorName: 'LibreChat',
        authorId: 'system',
        isPublic: true,
        promoted: true,
        tools: ['analysis'],
        starters: [
          'Create a comparison matrix of PostgreSQL, MongoDB, and SQLite',
          'Explain how Server-Sent Events differ from WebSockets for AI streaming',
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'agent-editorial-writer',
        name: 'Editorial & Docs Writer',
        description:
          'Transforms rough notes into crisp product announcements, developer documentation, and technical RFCs.',
        instructions:
          'You are an editorial technical writer. Prioritize clarity, active voice, and scannable structure without fluff.',
        category: 'writing',
        provider: 'google',
        model: 'gemini-2.5-flash',
        authorName: 'LibreChat',
        authorId: 'system',
        isPublic: true,
        promoted: false,
        tools: ['writing'],
        starters: [
          'Draft a concise release changelog from these bullet points',
          'Rewrite an API error guide to be developer-friendly',
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'agent-productivity-planner',
        name: 'Sprint & Workflow Planner',
        description:
          'Turns ambiguous goals into prioritized milestones, risk checklists, and actionable engineering tasks.',
        instructions:
          'You are a pragmatic technical project lead. Decompose goals into concrete milestones, dependencies, acceptance criteria, and edge cases.',
        category: 'productivity',
        provider: 'google',
        model: 'gemini-2.5-flash',
        authorName: 'LibreChat',
        authorId: 'system',
        isPublic: true,
        promoted: false,
        tools: ['planning'],
        starters: [
          'Break down migrating a legacy monolith to modular services',
          'Create a pre-launch production readiness checklist',
        ],
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    for (const agent of seedAgents) {
      this.agents.set(agent.id, agent);
    }

    const seedPrompts: PromptRecord[] = [
      {
        id: nanoid(10),
        title: 'Senior Code Review',
        oneliner: 'Audit code for bugs, race conditions, security, and maintainability',
        prompt:
          'Review the following code as a staff software engineer. Identify bugs, edge cases, security issues, and concrete simplifications with code examples:\n\n',
        category: 'coding',
        command: 'review',
        authorId: 'system',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: nanoid(10),
        title: 'Architecture Tradeoff Matrix',
        oneliner: 'Compare architectural options across latency, cost, and complexity',
        prompt:
          'Compare the top 3 architectural approaches for the following problem. Include a Markdown table covering latency, operational complexity, scaling limits, and recommended choice:\n\n',
        category: 'research',
        command: 'matrix',
        authorId: 'system',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: nanoid(10),
        title: 'Interactive HTML Artifact',
        oneliner: 'Generate a self-contained HTML/CSS/JS interactive component',
        prompt:
          'Build a clean, self-contained HTML artifact (inside a single ```html code block) with embedded CSS and vanilla JS for:\n\n',
        category: 'coding',
        command: 'artifact',
        authorId: 'system',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: nanoid(10),
        title: 'Concise Executive Summary',
        oneliner: 'Distill long notes into key decisions, risks, and next steps',
        prompt:
          'Summarize the text below into: 1) Core Takeaway, 2) Key Decisions, 3) Open Risks, and 4) Action Items:\n\n',
        category: 'productivity',
        command: 'summary',
        authorId: 'system',
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    for (const prompt of seedPrompts) {
      this.prompts.set(prompt.id, prompt);
    }

    const seedPreset: PresetRecord = {
      presetId: 'preset-balanced-gemini',
      userId: 'local-user',
      title: 'Balanced Gemini Flash',
      endpoint: 'google',
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      topP: 0.95,
      createdAt: now(),
    };
    this.presets.set(seedPreset.presetId, seedPreset);
  }
}

export const store = new MemoryStore();
