export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export enum ResearchPhase {
  STRUCTURE = 'Estructuración y Diseño',
  VARIABLES = 'Modelado de Variables',
  RESOURCES = 'Mapeo de Recursos',
  EXECUTION = 'Cronograma y Ejecución',
}

export interface ProjectState {
  title: string;
  currentPhase: ResearchPhase;
  variablesIdentified: boolean;
}

export interface ProjectSummary {
  projectTitle: string;
  phase1_structure: string | null;
  phase2_variables: string | null;
  phase3_resources: string | null;
  phase4_execution: string | null;
  lastActivePhase: string;
  timestamp: string;
}

// --- NEW INTERFACES FOR UPDATES ---

export interface WizardData {
  field: string;
  phenomenon: string;
  hypothesis: string;
}

export interface SimulationVariable {
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  description: string;
}

export interface SimulationConfig {
  independentVariables: SimulationVariable[];
  dependentVariableLabel: string;
  h0_formula: string; // JS string expression, e.g. "0.5 * x + 2"
  h1_formula: string; // JS string expression, e.g. "2 * x + 5"
  explanation: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
  details: string;
  connections: string[]; // IDs of connected nodes
}

export interface DiagramData {
  nodes: DiagramNode[];
}