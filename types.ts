export type FileSystemState = Record<string, string>;

export interface Template {
  id: string;
  name: string;
  type: 'base' | 'ui' | 'datastore';
  path: string;
  description: string;
}

export interface HandoverLog {
  action: 'create' | 'command' | 'feature-add' | 'debug';
  by: string; // operator name
  at: string; // ISO timestamp
  details: Record<string, any>;
}

export interface Container {
  id: string;
  operator: string;
  prompt: string;
  status: 'initialized' | 'installing' | 'installed' | 'building' | 'built' | 'running' | 'error';
  createdAt: string;
  path: string;
  chosenTemplates: {
    base: string;
    ui: string[];
    datastore?: string;
  };
  history: HandoverLog[];
  env?: { [key: string]: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  explanation?: string;
  code?: {
    path: string;
    content: string;
  }[];
}

export interface DraggableComponent {
  id: string;
  name: string;
  html: string;
}

export interface LayoutTemplateData {
  id:string;
  name: string;
  description: string;
  html: string;
  css: string;
  js?: string;
}

export interface OrchestrationPlan {
  title: string;
  steps: { description: string; status: 'pending' | 'completed' | 'error' }[];
  code: { path: string; content: string }[];
  review: string;
}