export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

export type EndpointConfig = {
  id: string;
  name: string;
  icon: string;
  envKey: string;
  models: string[];
  configured: boolean;
};

export type StartupConfig = {
  appTitle: string;
  version: string;
  registrationEnabled: boolean;
  emailLoginEnabled: boolean;
  configuredProviders: Record<string, boolean>;
  endpoints: EndpointConfig[];
};

export type MessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
};

export type Message = {
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

export type Conversation = {
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

export type Agent = {
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

export type AgentCategory = {
  value: string;
  label: string;
};

export type PromptItem = {
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

export type Preset = {
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

export type ArtifactData = {
  id: string;
  title: string;
  language: 'html' | 'svg';
  code: string;
};
