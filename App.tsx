import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Chat, GenerateContentResponse, Content } from "@google/genai";
import { 
  startChatSession, 
  generateProjectStateSummary, 
  generateSimulationConfig,
  generateDiagramData
} from './services/geminiService';
import { 
  Message, 
  Role, 
  ProjectSummary, 
  WizardData, 
  SimulationConfig, 
  DiagramData,
  DiagramNode
} from './types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- TRANSLATION STRINGS ---
const I18N = {
  es: {
    title: "ARCH",
    subtitle: "Arquitecto de Investigación",
    menuTitle: "¿Cómo desea iniciar?",
    modeWizard: "Modo Guiado (Wizard)",
    modeWizardDesc: "Responda unas preguntas clave y deje que ARCH estructure el proyecto por usted.",
    modeManual: "Desde Cero",
    modeManualDesc: "Inicie una sesión en blanco y converse libremente con el arquitecto.",
    modeLoad: "Cargar Sesión",
    modeLoadDesc: "Restaure un proyecto previo desde un archivo JSON.",
    modeDemo: "Ejemplo (Demo)",
    modeDemoDesc: "Cargue un caso de estudio precargado para explorar las herramientas.",
    wizardTitle: "Configuración Inicial",
    fieldLabel: "¿Cuál es tu campo de estudio general?",
    fieldPlaceholder: "Ej. Biología Marina, Sociología Urbana...",
    fieldHint: "Esto ayuda a ARCH a ajustar su vocabulario técnico.",
    phenomenonLabel: "¿Qué fenómeno o problema quieres investigar?",
    phenomenonPlaceholder: "Ej. He notado una disminución en la población...",
    hypothesisLabel: "¿Tienes alguna sospecha o idea preliminar?",
    hypothesisPlaceholder: "Ej. Sospecho que la frecuencia de onda...",
    back: "Atrás",
    next: "Siguiente",
    start: "Iniciar Proyecto",
    mapBtn: "Mapa de Proyecto",
    simBtn: "Simular Hipótesis",
    restartConfirm: "¿Estás seguro de que deseas reiniciar la sesión? Perderás los cambios no guardados.",
    restoreTitle: "PROYECTO RESTAURADO",
    restoreMsg: "Recuperando contexto...",
    restoreAction: "Analiza el contexto anterior, resume brevemente en qué punto quedamos y cuál es el siguiente paso lógico.",
    inputPlaceholder: "Describa su propuesta de investigación o presione Enter...",
    simTitle: "Simulador de Hipótesis",
    simAnalysis: "Analizando variables y generando modelo...",
    simVars: "Variables Independientes (X)",
    simRel: "RELACIÓN ESPERADA",
    simImpact: "Impacto en",
    simError: "No se pudo generar la configuración de la simulación.",
    mapTitle: "Mapa del Proyecto",
    mapLoading: "Estructurando diagrama...",
    mapEmpty: "No hay datos del diagrama disponibles.",
    loading: "Procesando..."
  },
  en: {
    title: "ARCH",
    subtitle: "Research Architect",
    menuTitle: "How would you like to start?",
    modeWizard: "Guided Mode (Wizard)",
    modeWizardDesc: "Answer a few key questions and let ARCH structure the project for you.",
    modeManual: "From Scratch",
    modeManualDesc: "Start a blank session and converse freely with the architect.",
    modeLoad: "Load Session",
    modeLoadDesc: "Restore a previous project from a JSON file.",
    modeDemo: "Example (Demo)",
    modeDemoDesc: "Load a pre-filled case study to explore the tools.",
    wizardTitle: "Initial Setup",
    fieldLabel: "What is your general field of study?",
    fieldPlaceholder: "e.g. Marine Biology, Urban Sociology...",
    fieldHint: "This helps ARCH adjust its technical vocabulary.",
    phenomenonLabel: "What phenomenon or problem do you want to investigate?",
    phenomenonPlaceholder: "e.g. I have noticed a decrease in the population...",
    hypothesisLabel: "Do you have any preliminary suspicion or idea?",
    hypothesisPlaceholder: "e.g. I suspect that the wave frequency...",
    back: "Back",
    next: "Next",
    start: "Start Project",
    mapBtn: "Project Map",
    simBtn: "Simulate Hypotheses",
    restartConfirm: "Are you sure you want to restart the session? Unsaved progress will be lost.",
    restoreTitle: "PROJECT RESTORED",
    restoreMsg: "Recovering context...",
    restoreAction: "Analyze the previous context, briefly summarize where we left off, and state the next logical step.",
    inputPlaceholder: "Describe your research proposal or press Enter...",
    simTitle: "Hypothesis Simulator",
    simAnalysis: "Analyzing variables and generating model...",
    simVars: "Independent Variables (X)",
    simRel: "EXPECTED RELATIONSHIP",
    simImpact: "Impact on",
    simError: "Could not generate simulation configuration.",
    mapTitle: "Project Map",
    mapLoading: "Structuring diagram...",
    mapEmpty: "No diagram data available.",
    loading: "Processing..."
  }
};

// --- DEMO DATA ---
const DEMO_MESSAGES: Message[] = [
  {
    id: 'demo-1',
    role: Role.MODEL,
    text: "Bienvenido a **ARCH**. Soy su Arquitecto de Investigación. Para comenzar la **Fase 1**, por favor enuncie su idea preliminar. **¿Qué fenómeno desea estudiar?**",
    timestamp: new Date(Date.now() - 100000)
  },
  {
    id: 'demo-2',
    role: Role.USER,
    text: "Quiero investigar el efecto de la privación de sueño en el rendimiento cognitivo de estudiantes universitarios de ingeniería.",
    timestamp: new Date(Date.now() - 90000)
  },
  {
    id: 'demo-3',
    role: Role.MODEL,
    text: "Excelente punto de partida. Para garantizar rigor científico, debemos operacionalizar esto.\n\n**¿Cuál sería su Variable Independiente (X) específica y cómo planea manipularla?**",
    timestamp: new Date(Date.now() - 80000)
  },
  {
    id: 'demo-4',
    role: Role.USER,
    text: "La Variable Independiente (X) serán las horas de sueño permitidas la noche anterior al test (0, 4, y 8 horas).",
    timestamp: new Date(Date.now() - 70000)
  },
  {
    id: 'demo-5',
    role: Role.MODEL,
    text: "Entendido. Ahora la Variable Dependiente (Y). **¿Qué instrumento métrico utilizará para medir el 'rendimiento cognitivo'?**",
    timestamp: new Date(Date.now() - 60000)
  },
  {
    id: 'demo-6',
    role: Role.USER,
    text: "Usaré el Test de Matrices Progresivas de Raven para medir razonamiento abstracto.",
    timestamp: new Date(Date.now() - 50000)
  },
  {
    id: 'demo-7',
    role: Role.MODEL,
    text: "Muy bien. Hemos definido una estructura causal clara:\n\n$$X (Sueño) \\rightarrow Y (Puntaje Raven)$$\n\nAhora, formulemos las hipótesis estadísticas.\n\n$H_0$: $\\mu_{0h} = \\mu_{4h} = \\mu_{8h}$ (No hay diferencia significativa).\n$H_1$: $\\mu_{8h} > \\mu_{4h} > \\mu_{0h}$ (A mayor sueño, mayor rendimiento).\n\nEstamos listos para modelar las variables de confusión. **¿Ha considerado el consumo de cafeína como variable interviniente?**",
    timestamp: new Date(Date.now() - 40000)
  }
];

const DEMO_SIMULATION_CONFIG: SimulationConfig = {
  independentVariables: [
    {
      name: 'sleepHours',
      label: 'Horas de Sueño',
      min: 0,
      max: 10,
      defaultValue: 4,
      description: 'Horas de descanso permitidas antes de la evaluación cognitiva.'
    }
  ],
  dependentVariableLabel: 'Puntaje Raven (0-60)',
  h0_formula: '35',
  h1_formula: '20 + 3 * sleepHours',
  explanation: 'Modelo Lineal: Se asume que por cada hora adicional de sueño, el puntaje en el test de Raven aumenta en 3 puntos, partiendo de una base de 20.'
};

const DEMO_DIAGRAM_DATA: DiagramData = {
  nodes: [
    { 
      id: 'n1', 
      label: 'Problema', 
      status: 'completed', 
      details: 'Disminución de rendimiento cognitivo en estudiantes.', 
      connections: ['n2'] 
    },
    { 
      id: 'n2', 
      label: 'Hipótesis', 
      status: 'completed', 
      details: 'Privación de sueño afecta negativamente el razonamiento abstracto.', 
      connections: ['n3'] 
    },
    { 
      id: 'n3', 
      label: 'Variables', 
      status: 'active', 
      details: 'VI: Horas de sueño (0, 4, 8) | VD: Test Raven.', 
      connections: ['n4'] 
    },
    { 
      id: 'n4', 
      label: 'Ejecución', 
      status: 'pending', 
      details: 'Diseño experimental y recolección de datos.', 
      connections: [] 
    }
  ]
};

// --- MEMOIZED MESSAGE COMPONENT ---
const MessageBubble = React.memo(({ msg }: { msg: Message }) => {
  return (
    <div className={cn("flex gap-4 p-4 rounded-xl border transition-all duration-300", msg.role === Role.USER ? "bg-slate-800/50 border-slate-700 ml-12" : "bg-slate-900/50 border-slate-800 mr-12 shadow-sm")}>
      <div className={cn("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold", msg.role === Role.USER ? "bg-slate-700 text-slate-300" : "bg-teal-900/30 text-teal-400 border border-teal-800/50")}>
        {msg.role === Role.USER ? 'U' : 'AI'}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden prose prose-invert prose-slate max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[[rehypeKatex, { strict: false }]]}
          components={{
            strong: ({node, ...props}) => <span className="text-amber-400 font-bold tracking-wide" {...props} />
          }}
        >
          {msg.text}
        </ReactMarkdown>
        {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-teal-500/50 animate-pulse align-middle"></span>}
      </div>
    </div>
  );
});

// --- START MENU COMPONENT ---
const StartMenu = ({ onSelect, lang }: { onSelect: (mode: 'wizard' | 'scratch' | 'load' | 'demo') => void, lang: 'es' | 'en' }) => {
  const t = I18N[lang];
  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="menu-title">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl w-full my-auto"
      >
        <div className="text-center mb-12">
           <div className="flex items-center justify-center tracking-tight mb-4">
              <span className="text-slate-600 text-2xl font-medium">rese</span>
              <span className="text-teal-400 text-5xl font-black mx-1 tracking-wide">ARCH</span>
              <span className="text-slate-600 text-2xl font-medium">itect</span>
           </div>
           <p className="text-slate-400 text-lg" id="menu-title">{t.menuTitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {/* Option 1: Wizard */}
           <button 
             onClick={() => onSelect('wizard')}
             className="group bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-teal-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col gap-4 h-full"
           >
             <div className="w-12 h-12 bg-teal-900/30 rounded-lg flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-100 mb-2">{t.modeWizard}</h3>
               <p className="text-sm text-slate-400">{t.modeWizardDesc}</p>
             </div>
           </button>

           {/* Option 2: Scratch */}
           <button 
             onClick={() => onSelect('scratch')}
             className="group bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col gap-4 h-full"
           >
             <div className="w-12 h-12 bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-100 mb-2">{t.modeManual}</h3>
               <p className="text-sm text-slate-400">{t.modeManualDesc}</p>
             </div>
           </button>

           {/* Option 3: Load */}
           <button 
             onClick={() => onSelect('load')}
             className="group bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-rose-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col gap-4 h-full"
           >
             <div className="w-12 h-12 bg-rose-900/30 rounded-lg flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-100 mb-2">{t.modeLoad}</h3>
               <p className="text-sm text-slate-400">{t.modeLoadDesc}</p>
             </div>
           </button>

           {/* Option 4: Demo */}
           <button 
             onClick={() => onSelect('demo')}
             className="group bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-amber-500/50 hover:bg-slate-800/50 transition-all text-left flex flex-col gap-4 h-full"
           >
             <div className="w-12 h-12 bg-amber-900/30 rounded-lg flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-100 mb-2">{t.modeDemo}</h3>
               <p className="text-sm text-slate-400">{t.modeDemoDesc}</p>
             </div>
           </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- WIZARD COMPONENT ---
const Wizard = ({ onComplete, onCancel, lang }: { onComplete: (data: WizardData) => void, onCancel: () => void, lang: 'es' | 'en' }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ field: '', phenomenon: '', hypothesis: '' });
  const t = I18N[lang];

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => {
    onComplete(data);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative"
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-teal-400 tracking-tight mb-2">ARCH</h1>
            <p className="text-slate-400" id="wizard-title">{t.wizardTitle}</p>
        </div>

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">{t.fieldLabel}</label>
              <input 
                autoFocus
                type="text" 
                value={data.field} 
                onChange={(e) => setData({...data, field: e.target.value})}
                placeholder={t.fieldPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all"
              />
              <p className="text-xs text-slate-500">{t.fieldHint}</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">{t.phenomenonLabel}</label>
              <textarea 
                autoFocus
                value={data.phenomenon} 
                onChange={(e) => setData({...data, phenomenon: e.target.value})}
                placeholder={t.phenomenonPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all h-32 resize-none"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">{t.hypothesisLabel}</label>
              <textarea 
                autoFocus
                value={data.hypothesis} 
                onChange={(e) => setData({...data, hypothesis: e.target.value})}
                placeholder={t.hypothesisPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all h-32 resize-none"
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between">
            {step > 1 ? (
                <button onClick={prevStep} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">{t.back}</button>
            ) : <div></div>}
            
            {step < 3 ? (
                <button 
                  onClick={nextStep} 
                  disabled={step === 1 ? !data.field : !data.phenomenon}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    {t.next}
                </button>
            ) : (
                <button 
                  onClick={handleSubmit} 
                  disabled={!data.hypothesis}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    {t.start}
                </button>
            )}
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
            {[1,2,3].map(i => (
                <div key={i} className={cn("w-2 h-2 rounded-full transition-colors", i === step ? "bg-teal-500" : "bg-slate-800")} />
            ))}
        </div>
      </motion.div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const t = I18N[language];
  
  // 'menu' is the initial state now
  const [viewState, setViewState] = useState<'menu' | 'wizard' | 'chat'>('menu');
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: Role.MODEL,
      text: "Bienvenido al sistema **ARCH**. Soy su Arquitecto de Investigación.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New States for Features
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig | null>(null);
  const [simValues, setSimValues] = useState<Record<string, number>>({});
  const [isSimLoading, setIsSimLoading] = useState(false);

  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [isDiagramLoading, setIsDiagramLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initSession = async (customHistory?: Content[]) => {
      try {
        const session = await startChatSession(customHistory);
        setChatSession(session);
        return session;
      } catch (error) {
        console.error("Failed to initialize chat session:", error);
        return null;
      }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleLanguage = () => {
      const newLang = language === 'es' ? 'en' : 'es';
      setLanguage(newLang);
  };

  // --- START MENU HANDLERS ---
  const handleStartSelection = async (mode: 'wizard' | 'scratch' | 'load' | 'demo') => {
    if (mode === 'wizard') {
      setViewState('wizard');
    } else if (mode === 'scratch') {
      setViewState('chat');
      initSession(); 
    } else if (mode === 'load') {
      fileInputRef.current?.click();
    } else if (mode === 'demo') {
      setViewState('chat');
      setMessages(DEMO_MESSAGES);
      
      // Preload facilities data for instant visualization
      setSimulationConfig(DEMO_SIMULATION_CONFIG);
      setSimValues({ sleepHours: 4 });
      setDiagramData(DEMO_DIAGRAM_DATA);

      // Convert internal messages to Gemini Content for the session context
      const demoHistory: Content[] = DEMO_MESSAGES.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      initSession(demoHistory);
    }
  };

  const handleWizardComplete = async (data: WizardData) => {
      setViewState('chat');
      setIsLoading(true);

      const introPrompt = `
      [CONTEXT: User Language is ${language.toUpperCase()}]
      CONTEXTO INICIAL DEL USUARIO:
      - Campo: ${data.field}
      - Fenómeno: ${data.phenomenon}
      - Hipótesis inicial: ${data.hypothesis}
      
      Por favor, inicia la Fase 1 analizando esta información preliminar.
      `;

      // Synthesize history
      const history: Content[] = [
        { role: 'user', parts: [{ text: "Hola, quiero iniciar un proyecto." }] },
        { role: 'model', parts: [{ text: "Bienvenido a ARCH. Por favor proporcione el contexto inicial." }] },
        { role: 'user', parts: [{ text: introPrompt }] }
      ];

      try {
          const session = await initSession(history);
          if (!session) return;
          
          // Generate first response
          const result = await session.sendMessageStream({ message: "Analiza mi contexto y arranca la Fase 1." });
          
          let fullResponseText = '';
          const responseId = 'wizard-response';
          
          setMessages([
              {
                  id: responseId,
                  role: Role.MODEL,
                  text: '',
                  timestamp: new Date(),
                  isStreaming: true
              }
          ]);

          for await (const chunk of result) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
                fullResponseText += c.text;
                setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, text: fullResponseText } : msg));
            }
          }
          setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, isStreaming: false } : msg));

      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !chatSession || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatSession.sendMessageStream({ message: userMessage.text });
      
      let fullResponseText = '';
      const responseId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, {
        id: responseId,
        role: Role.MODEL,
        text: '',
        timestamp: new Date(),
        isStreaming: true
      }]);

      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        const chunkText = c.text;
        if (chunkText) {
            fullResponseText += chunkText;
            setMessages(prev => prev.map(msg => 
            msg.id === responseId ? { ...msg, text: fullResponseText } : msg));
        }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === responseId ? { ...msg, isStreaming: false } : msg));

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: Role.MODEL,
        text: "Error.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- FEATURE HANDLERS ---

  const openSimulation = async () => {
      setShowSimulation(true);
      if (!simulationConfig) {
          setIsSimLoading(true);
          try {
              const config = await generateSimulationConfig(messages);
              setSimulationConfig(config);
              const defaults: Record<string, number> = {};
              config.independentVariables.forEach(v => {
                  defaults[v.name] = v.defaultValue;
              });
              setSimValues(defaults);
          } catch (e) {
              console.error(e);
          } finally {
              setIsSimLoading(false);
          }
      }
  };

  const openDiagram = async () => {
      setShowDiagram(true);
      setIsDiagramLoading(true);
      try {
          const data = await generateDiagramData(messages, language); // Pass language here
          setDiagramData(data);
      } catch (e) {
          console.error(e);
      } finally {
          setIsDiagramLoading(false);
      }
  };

  // --- SAVE / LOAD / RESET ---

  const handleResetSession = async () => {
    if (window.confirm(t.restartConfirm)) {
        window.location.reload(); 
    }
  };

  const handleSaveProgress = async () => {
    if (messages.length < 2) return;
    setIsSaving(true);
    try {
      const summary = await generateProjectStateSummary(messages);
      const dataStr = JSON.stringify(summary, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = summary.projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      link.download = `arch-${safeTitle}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const projectData = JSON.parse(json) as ProjectSummary;
        
        setViewState('chat');
        setIsLoading(true);

        const restorationContext = `
        **${t.restoreTitle}**
        [METADATA]
        TÍTULO: ${projectData.projectTitle}
        ESTADO: ${projectData.lastActivePhase}
        
        [SUMMARY]
        ${projectData.phase1_structure ? `F1 STRUCTURE: ${projectData.phase1_structure}` : ''}
        ${projectData.phase2_variables ? `F2 VARIABLES: ${projectData.phase2_variables}` : ''}
        ${projectData.phase3_resources ? `F3 RESOURCES: ${projectData.phase3_resources}` : ''}
        ${projectData.phase4_execution ? `F4 EXECUTION: ${projectData.phase4_execution}` : ''}
        `;

        const history: Content[] = [
            { role: 'user', parts: [{ text: "System Start." }] },
            { role: 'model', parts: [{ text: "Ready." }] },
            { role: 'user', parts: [{ text: restorationContext }] },
            { role: 'model', parts: [{ text: "Context Loaded." }] }
        ];

        // Important: Use the session returned directly, not state
        const session = await initSession(history);
        
        // Only show the system message locally, don't double add to history context yet
        setMessages([
            {
                id: 'restore-msg',
                role: Role.MODEL,
                text: `**${t.restoreTitle}**: ${projectData.projectTitle}\n\n*${t.restoreMsg}*`,
                timestamp: new Date()
            }
        ]);

        if (session) {
           // Immediately ask for summary
           const result = await session.sendMessageStream({ message: t.restoreAction });
           
           let fullResponseText = '';
           const responseId = 'restoration-response';
           
           setMessages(prev => [...prev, {
              id: responseId,
              role: Role.MODEL,
              text: '',
              timestamp: new Date(),
              isStreaming: true
           }]);

           for await (const chunk of result) {
              const c = chunk as GenerateContentResponse;
              if (c.text) {
                  fullResponseText += c.text;
                  setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, text: fullResponseText } : msg));
              }
           }
           setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, isStreaming: false } : msg));
        }

      } catch (err) {
        console.error(err);
        alert("Error al cargar.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const calculateChartData = () => {
      if (!simulationConfig || !simValues) return [];
      const data = [];
      const mainVar = simulationConfig.independentVariables[0];
      if (!mainVar) return [];

      const currentX = simValues[mainVar.name] || mainVar.defaultValue;
      const range = (mainVar.max - mainVar.min) / 2;
      const start = Math.max(mainVar.min, currentX - range/2);
      
      for (let i = 0; i < 10; i++) {
          const xVal = start + (range / 10) * i;
          let h0 = 0;
          let h1 = 0;
          try {
             const scope = { ...simValues, [mainVar.name]: xVal };
             const keys = Object.keys(scope);
             const values = Object.values(scope);
             
             h0 = new Function(...keys, `return ${simulationConfig.h0_formula}`)(...values);
             h1 = new Function(...keys, `return ${simulationConfig.h1_formula}`)(...values);
          } catch (e) {
             console.warn("Formula error", e);
          }

          data.push({
              name: xVal.toFixed(1),
              H0: h0,
              H1: h1,
              amt: xVal
          });
      }
      return data;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
      
      {/* START SCREEN LAYERS */}
      {viewState === 'menu' && (
        <StartMenu 
            onSelect={handleStartSelection} 
            lang={language} 
        />
      )}

      {viewState === 'wizard' && (
        <Wizard 
            onComplete={handleWizardComplete} 
            onCancel={() => setViewState('menu')}
            lang={language} 
        />
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4 select-none">
          <div className="flex items-baseline tracking-tight group cursor-default">
            <span className="text-slate-600 text-lg sm:text-xl font-medium">rese</span>
            <span className="text-teal-400 text-2xl sm:text-3xl font-black mx-[1px] tracking-wide relative">
              ARCH
            </span>
            <span className="text-slate-600 text-lg sm:text-xl font-medium">itect</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Action Buttons */}
          <button 
             onClick={toggleLanguage}
             className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors"
          >
             {language === 'es' ? 'SPA' : 'ENG'}
          </button>
          
          <div className="w-px h-6 bg-slate-700 mx-1"></div>

          <button 
             onClick={openDiagram}
             disabled={viewState !== 'chat'}
             className="px-3 py-1.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
               <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
               <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
             </svg>
             <span className="hidden sm:inline">{t.mapBtn}</span>
          </button>

          <button 
             onClick={openSimulation}
             disabled={viewState !== 'chat'}
             className="px-3 py-1.5 text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
             </svg>
             <span className="hidden sm:inline">{t.simBtn}</span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1"></div>

          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          
          <button onClick={handleResetSession} className="p-2 text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors" title="Reiniciar">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.25a1 1 0 11-2 0V13.001a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
          </button>

          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors" title="Cargar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
          
          <button onClick={handleSaveProgress} disabled={isSaving || viewState !== 'chat'} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30" title="Guardar">
             {isSaving ? <span className="animate-spin block w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>}
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={viewState !== 'chat'}
              placeholder={viewState === 'chat' ? t.inputPlaceholder : ""}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-600 resize-none min-h-[60px] max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
            />
            <button onClick={handleSendMessage} disabled={!input.trim() || isLoading || viewState !== 'chat'} className="absolute right-3 bottom-3 p-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
        </div>
      </footer>

      {/* --- SIMULATION MODAL --- */}
      <AnimatePresence>
        {showSimulation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sim-title">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <h2 className="text-xl font-bold text-teal-400" id="sim-title">{t.simTitle}</h2>
                        <button onClick={() => setShowSimulation(false)} className="text-slate-400 hover:text-white" aria-label="Close">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {isSimLoading ? (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4">
                                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full"></div>
                                <p className="text-slate-400">{t.simAnalysis}</p>
                            </div>
                        ) : simulationConfig ? (
                            <>
                                {/* Controls Panel */}
                                <div className="w-full md:w-80 p-6 border-r border-slate-800 overflow-y-auto bg-slate-900/50">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">{t.simVars}</h3>
                                    <div className="space-y-6">
                                        {simulationConfig.independentVariables.map((variable) => (
                                            <div key={variable.name} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <label className="text-slate-200 font-medium">{variable.label}</label>
                                                    <span className="text-teal-400 font-mono">{simValues[variable.name]}</span>
                                                </div>
                                                <input 
                                                    type="range"
                                                    min={variable.min}
                                                    max={variable.max}
                                                    step={(variable.max - variable.min) / 100}
                                                    value={simValues[variable.name] || variable.defaultValue}
                                                    onChange={(e) => setSimValues({...simValues, [variable.name]: parseFloat(e.target.value)})}
                                                    className="w-full accent-teal-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <p className="text-xs text-slate-500">{variable.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <h4 className="text-xs font-bold text-slate-400 mb-2">{t.simRel}</h4>
                                        <p className="text-xs text-slate-300 leading-relaxed">{simulationConfig.explanation}</p>
                                    </div>
                                </div>

                                {/* Graph Panel */}
                                <div className="flex-1 p-6 bg-slate-950 flex flex-col">
                                    <h3 className="text-center text-slate-300 mb-2 font-medium">
                                        {t.simImpact} <span className="text-indigo-400">{simulationConfig.dependentVariableLabel} (Y)</span>
                                    </h3>
                                    <div className="flex-1 w-full min-h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={calculateChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="name" stroke="#94a3b8" label={{ value: 'Valor Actual X', position: 'insideBottom', offset: -10 }} />
                                                <YAxis stroke="#94a3b8" />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                                    itemStyle={{ color: '#f1f5f9' }}
                                                />
                                                <Legend />
                                                <Line type="monotone" dataKey="H0" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Hipótesis Nula (H0)" dot={false} />
                                                <Line type="monotone" dataKey="H1" stroke="#2dd4bf" strokeWidth={3} name="Hipótesis Trabajo (H1)" activeDot={{ r: 8 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500">
                                {t.simError}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- DIAGRAM MODAL --- */}
      <AnimatePresence>
        {showDiagram && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="map-title">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[85vh] rounded-2xl flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-indigo-400" id="map-title">{t.mapTitle}</h2>
                        <button onClick={() => setShowDiagram(false)} className="text-slate-400 hover:text-white" aria-label="Close">Close</button>
                    </div>
                    <div className="flex-1 overflow-auto p-8 relative bg-slate-950/50">
                        {isDiagramLoading ? (
                             <div className="flex items-center justify-center h-full flex-col gap-4">
                                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                                <p className="text-slate-400">{t.mapLoading}</p>
                            </div>
                        ) : diagramData ? (
                            <div className="flex flex-col items-center gap-12 min-w-[600px]">
                                {/* A simple automatic layout renderer */}
                                {diagramData.nodes.map((node, idx) => (
                                    <div key={node.id} className="relative group w-full max-w-2xl">
                                        {/* Connector Line */}
                                        {idx < diagramData.nodes.length - 1 && (
                                            <div className="absolute left-1/2 top-full h-12 w-0.5 bg-slate-700 -translate-x-1/2 z-0"></div>
                                        )}
                                        
                                        <div className={cn(
                                            "relative z-10 p-6 rounded-xl border-2 transition-all flex justify-between items-start gap-4",
                                            node.status === 'completed' ? "bg-slate-800/80 border-teal-500/50" :
                                            node.status === 'active' ? "bg-slate-800/80 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]" :
                                            "bg-slate-900 border-slate-800 opacity-60"
                                        )}>
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider",
                                                        node.status === 'completed' ? "bg-teal-900/50 text-teal-400" :
                                                        node.status === 'active' ? "bg-indigo-900/50 text-indigo-400" :
                                                        "bg-slate-800 text-slate-500"
                                                    )}>
                                                        {node.status}
                                                    </span>
                                                    <h3 className="text-lg font-bold text-slate-100">{node.label}</h3>
                                                </div>
                                                <p className="text-sm text-slate-400 leading-relaxed">{node.details}</p>
                                            </div>
                                            {node.status === 'completed' && (
                                                <div className="bg-teal-500 rounded-full p-1 text-slate-900">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">{t.mapEmpty}</div>
                        )}
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}