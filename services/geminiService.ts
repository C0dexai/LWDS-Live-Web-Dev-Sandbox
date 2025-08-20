import { GoogleGenAI, Type } from "@google/genai";
import type { FileSystemState, ChatMessage } from '../types';

function formatFileSystemForPrompt(fileSystem: FileSystemState, previewRoot: string | null): string {
    const fileEntries = Object.entries(fileSystem)
        .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
        // Exclude template files from the context to keep it focused on the user's containers
        .filter(([path]) => !path.startsWith('/templates/'))
        .map(([path, content]) => {
            const language = path.split('.').pop() || '';
            return `
---
File: ${path}
\`\`\`${language}
${content}
\`\`\`
`;
        });
    
    const previewContext = previewRoot ? `The user is currently previewing the project from the "${previewRoot}" container directory.` : 'The user is not currently previewing any container.';

    return `Here is the current state of all files in the user's containers. Use this as context for the user's request.
${previewContext}
${fileEntries.join('')}
---
`;
}

export async function chatWithAgent(history: ChatMessage[], fileSystem: FileSystemState, previewRoot: string | null): Promise<{ text: string, explanation: string, code?: { path: string, content: string }[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = "gemini-2.5-flash";

    const systemInstruction = `You are an expert AI system operator and a helpful guide for a web development sandbox. Your primary goal is to help the user build web applications using a container-based system.

The user interacts with a "System Operator" panel to manage their builds. They can:
1.  **Create a Container**: They choose a base template (like React+Vite), a UI library (like Tailwind), and a datastore (like IndexedDB). This scaffolds a new project in the '/containers/' directory.
2.  **Run Commands**: They can simulate commands like 'Install' (dependencies) and 'Build' within a container.
3.  **Start/Preview**: They can "Start" a container, which makes its content visible in the live preview panel.

Your role is to guide the user through this process and help them modify the code within their containers.

When the user asks for a code change:
1.  Provide a brief, friendly, conversational response in the 'text' field.
2.  Provide a detailed explanation in the 'explanation' field (using markdown). Explain your changes and suggest next steps.
3.  Include the complete, full file content for all modified files in the 'code' property. The 'code' property must be an array of objects, with 'path' and 'content' keys. Ensure the file paths are correct (e.g., inside the relevant /containers/<id>/src/ folder).

**Example Guidance:**
- If the user is new: "Welcome! To get started, you can create a new build container using the System Operator panel. Just click 'Create New Container' and choose your templates."
- If the user wants a new feature: "Great idea. I can help with that. First, which container are we working on? I see you have [list containers]. Once you tell me, I can provide the code changes for the correct files."
- If they ask to add a library: "To add a new library, you'll need to update the 'package.json' file in your container. I can show you how to do that."

Your response MUST be a JSON object that adheres to the provided schema.

${formatFileSystemForPrompt(fileSystem, previewRoot)}
`;

    const contents = history
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }],
        }));

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        text: {
                            type: Type.STRING,
                            description: 'A brief, friendly, conversational reply to the user. Keep it short.'
                        },
                        explanation: {
                            type: Type.STRING,
                            description: "A detailed explanation of any code changes, including what was done, why it was done, and suggestions for the user's next steps. Use markdown for formatting (e.g., lists, bold text)."
                        },
                        code: {
                            type: Type.ARRAY,
                            description: "An array of objects, where each object has a 'path' and 'content' key. Represents all files modified by the agent.",
                            nullable: true,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    path: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                },
                                required: ['path', 'content']
                            }
                        }
                    },
                    required: ['text', 'explanation']
                }
            },
        });

        const responseText = response.text?.trim();
        if (!responseText) {
            console.error("Gemini API returned an empty or invalid response text.");
            throw new Error("Received an invalid response from the AI agent.");
        }
        
        const parsedJson = JSON.parse(responseText);

        if (parsedJson && parsedJson.text && parsedJson.explanation) {
             const { text, explanation, code } = parsedJson;
             if (code && Array.isArray(code)) {
                return { text, explanation, code };
             }
             return { text, explanation };
        }
        
        console.error("Gemini API returned unexpected JSON structure:", responseText);
        throw new Error("Received an invalid response from the AI agent.");

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                 throw new Error(`Invalid Gemini API key. Please ensure it is correctly configured in the environment.`);
            }
            throw new Error(`Gemini API request failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred while communicating with the Gemini API.");
    }
}

interface PlanAndCodeResult {
    title: string;
    steps: string[];
    code: { path: string; content: string }[];
}

export async function generatePlanAndCode(goal: string, fileSystem: FileSystemState): Promise<PlanAndCodeResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = "gemini-2.5-flash";

    const systemInstruction = `You are an expert AI software architect. Your task is to take a high-level user goal and deconstruct it into a detailed, step-by-step development plan. You must also provide all the necessary code changes to implement this plan.

The user is working in a container-based web development sandbox. The current file system is provided as context.

Based on the user's goal:
1.  Create a concise, descriptive title for the plan.
2.  Break down the task into a series of actionable steps.
3.  For each step that involves code, provide the complete, new file content for any files that need to be created or modified.

Your response MUST be a JSON object that adheres to the provided schema. Ensure file paths are correct, likely within one of the '/containers/<id>/' directories.

${formatFileSystemForPrompt(fileSystem, null)}
`;

    const contents = [{
        role: 'user' as const,
        parts: [{ text: `My goal is: ${goal}` }],
    }];

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "A concise title for the development plan."
                        },
                        steps: {
                            type: Type.ARRAY,
                            description: "An array of strings, where each string is a step in the plan.",
                            items: { type: Type.STRING }
                        },
                        code: {
                            type: Type.ARRAY,
                            description: "An array of objects representing all files that need to be created or modified.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    path: { type: Type.STRING, description: "The full path of the file." },
                                    content: { type: Type.STRING, description: "The complete new content of the file." }
                                },
                                required: ['path', 'content']
                            }
                        }
                    },
                    required: ['title', 'steps', 'code']
                }
            },
        });

        const responseText = response.text?.trim();
        if (!responseText) {
            throw new Error("Received an invalid response from the AI agent for plan generation.");
        }

        const parsedJson = JSON.parse(responseText);
        return parsedJson as PlanAndCodeResult;

    } catch (error) {
        console.error("Error calling Gemini API for plan generation:", error);
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                 throw new Error(`Invalid Gemini API key. Please ensure it is correctly configured in the environment.`);
            }
            throw new Error(`Gemini API request failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred while communicating with the Gemini API.");
    }
}

export async function getAiHint(history: ChatMessage[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = "gemini-2.5-flash";

    const systemInstruction = `You are a helpful AI assistant. The user is in a web development sandbox that uses a container-based build system. Based on the last few messages of the conversation, suggest one single, concise, and practical next step for the user.
- The suggestion should be a prompt the user can give to an AI.
- Return ONLY the suggested prompt text.
- Do NOT include any preamble, explanation, or markdown formatting.
- Be creative and helpful. For example, if the user just created a container, suggest they 'Install dependencies'. If they just installed, suggest they 'Start the dev server'.
- Keep the suggestion under 15 words.`;

    // Take the last 4 messages for context, it's enough for a hint.
    const lastMessages = history.slice(-4);
    
    const contents = lastMessages
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
            role: msg.role,
            // Use the main content for hints, not the detailed explanation
            parts: [{ text: msg.content }],
        }));

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.8, // Higher temperature for more creative hints
                stopSequences: ['\n'] // Stop at the first newline to keep it concise
            },
        });

        return response.text?.trim() || '';
    } catch (error) {
        console.error("Error fetching AI hint:", error);
        // Fail silently, a missing hint is not a critical error.
        return '';
    }
}