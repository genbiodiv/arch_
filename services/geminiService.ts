import { GoogleGenAI, Chat, Content, Type } from "@google/genai";
import { Message, Role, ProjectSummary, SimulationConfig, DiagramData } from "../types";

const SYSTEM_INSTRUCTION = `
**ROLE:**
You are "ARCH" (reseARCH + ARCHitect). You are an expert methodologist and high-level scientific project manager. Your goal is not to do the work for the user, but to interrogate them socratically to structure rigorous, viable, and fundable research projects.

**OPERATIONAL PHILOSOPHY:**
"Rigor First". Do not accept vague assertions. If the user says "I want to study X", ask about variables, causality, and data availability before moving to the schedule.

**IMPORTANT FORMATTING RULE:**
- **DIRECT QUESTIONS TO THE USER MUST BE IN BOLD.** This is critical for the UI to highlight them. (e.g., "**¿Cuál es su variable dependiente?**").
- Use LaTeX for formulas ($inline$ or $$block$$).
- Use Markdown tables for schedules/data.

**PHASES (Follow this logical order):**

1.  **PHASE 1: STRUCTURE & DESIGN**
    *   Validate the Question.
    *   Formulate Hypotheses ($H_0$, $H_1$).
    *   Define Objectives.

2.  **PHASE 2: VARIABLE MODELING**
    *   Independent ($X$), Dependent ($Y$), Confounding ($Z$).
    *   Challenge causality logic.

3.  **PHASE 3: RESOURCE MAPPING**
    *   Inputs (Literature, External Data).
    *   Outputs (Generated Data).

4.  **PHASE 4: EXECUTION**
    *   WBS (Work Breakdown Structure).
    *   Validation points.

**COMMANDS:**
* \`/modelar\`: Go to Phase 2.
* \`/cronograma\`: Generate WBS.
* \`/gap\`: Gap analysis.

**LANGUAGE:**
Adapt to the user's language (Spanish or English).
`;

let chatSession: Chat | null = null;
let genAI: GoogleGenAI | null = null;

export const initializeGemini = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing");
    return;
  }
  genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const startChatSession = async (customHistory?: Content[]): Promise<Chat> => {
  if (!genAI) initializeGemini();
  if (!genAI) throw new Error("Failed to initialize GoogleGenAI");

  const defaultHistory: Content[] = [
    {
      role: "user",
      parts: [{ text: "Hola, estoy listo para estructurar mi investigación." }],
    },
    {
      role: "model",
      parts: [{ text: "Bienvenido a **ARCH**. Soy su Arquitecto de Investigación. Para comenzar la **Fase 1**, por favor enuncie su idea preliminar. **¿Qué fenómeno desea estudiar?**" }],
    },
  ];

  chatSession = genAI.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
    history: customHistory || defaultHistory,
  });
  
  return chatSession;
};

export const generateProjectStateSummary = async (messages: Message[]): Promise<ProjectSummary> => {
    if (!genAI) initializeGemini();
    if (!genAI) throw new Error("Failed to initialize GoogleGenAI");

    const conversationText = messages
        .filter(m => m.id !== 'init-1' && m.id !== 'error-init')
        .map(m => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n\n');

    const prompt = `Analyze the following conversation and extract the CURRENT CONSOLIDATED state. 
    Ignore discarded ideas.
    
    CONVERSATION:
    ${conversationText}`;

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "You are a research project synthesizer. Extract only final agreements.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    projectTitle: { type: Type.STRING },
                    phase1_structure: { type: Type.STRING },
                    phase2_variables: { type: Type.STRING },
                    phase3_resources: { type: Type.STRING },
                    phase4_execution: { type: Type.STRING },
                    lastActivePhase: { type: Type.STRING },
                    timestamp: { type: Type.STRING }
                },
                required: ["projectTitle", "lastActivePhase"]
            }
        }
    });

    if (response.text) {
        const data = JSON.parse(response.text) as ProjectSummary;
        data.timestamp = new Date().toISOString();
        return data;
    }
    
    throw new Error("No se pudo generar el resumen");
};

export const generateSimulationConfig = async (messages: Message[]): Promise<SimulationConfig> => {
    if (!genAI) initializeGemini();
    if (!genAI) throw new Error("Failed to initialize GoogleGenAI");

    const conversationText = messages
        .filter(m => m.id !== 'init-1')
        .map(m => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n\n');

    const prompt = `Based on the conversation, extract hypothesis variables for simulation.
    Create JS formulas for H0 and H1.
    
    CONVERSATION:
    ${conversationText}`;

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    independentVariables: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                label: { type: Type.STRING },
                                min: { type: Type.NUMBER },
                                max: { type: Type.NUMBER },
                                defaultValue: { type: Type.NUMBER },
                                description: { type: Type.STRING }
                            }
                        }
                    },
                    dependentVariableLabel: { type: Type.STRING },
                    h0_formula: { type: Type.STRING },
                    h1_formula: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                }
            }
        }
    });

    if (response.text) {
        return JSON.parse(response.text) as SimulationConfig;
    }
    throw new Error("Failed to generate simulation config");
};

export const generateDiagramData = async (messages: Message[], language: 'es' | 'en' = 'es'): Promise<DiagramData> => {
    if (!genAI) initializeGemini();
    if (!genAI) throw new Error("Failed to initialize GoogleGenAI");

    const conversationText = messages
        .filter(m => m.id !== 'init-1')
        .map(m => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n\n');

    const prompt = `Create a structured node-based diagram of the research project status.
    Identify key components (Question, Hypothesis, Variables, Methodology).
    IMPORTANT: The labels and details MUST be in ${language === 'es' ? 'SPANISH' : 'ENGLISH'}.
    
    CONVERSATION:
    ${conversationText}`;

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    nodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                status: { type: Type.STRING, enum: ["pending", "active", "completed"] },
                                details: { type: Type.STRING },
                                connections: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        }
                    }
                }
            }
        }
    });

    if (response.text) {
        return JSON.parse(response.text) as DiagramData;
    }
    throw new Error("Failed to generate diagram data");
};