export interface HAConfig {
  baseUrl: string;
  token: string;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

export interface HADevice {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  area_id?: string;
}

export interface HAArea {
  area_id: string;
  name: string;
}

export interface HAAutomation {
  id: string;
  alias: string;
  description?: string;
  trigger?: any[];
  condition?: any[];
  action?: any[];
  mode?: string;
}

export interface HALovelaceCard {
  type: string;
  title?: string;
  entities?: (string | { entity: string; name?: string })[];
  [key: string]: any;
}

export interface HALovelaceView {
  title: string;
  path?: string;
  icon?: string;
  cards?: HALovelaceCard[];
}

export interface HALovelaceConfig {
  title?: string;
  views: HALovelaceView[];
}

export interface HACSPlugin {
  name: string;
  category: string;
  version: string;
  installed: boolean;
  update_available: boolean;
  description?: string;
}
