import React from 'react';
import { MarketplaceView } from './components/Agents/MarketplaceView';
import type { Agent, EndpointConfig, User } from './types';

export const AgentsViewWrapper: React.FC<{
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  endpoints: EndpointConfig[];
  user: User | null;
  onStartAgentChat: (agent: Agent) => void;
  onAgentsChanged: () => Promise<void>;
}> = (props) => {
  return <MarketplaceView {...props} />;
};
