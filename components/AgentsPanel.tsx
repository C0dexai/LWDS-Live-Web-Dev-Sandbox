import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';

import CodeEditor from './CodePreview';
import FileExplorer from './FileExplorer';
import ChatMessageView from './ChatMessage';
import SystemOperatorPanel from './SystemOperatorPanel';
import CollapsibleSection from './CollapsibleSection';
import Modal from './Modal';

import {
    GeminiIcon, MagicWandIcon, SpinnerIcon, XIcon,
    LightbulbIcon, MicrophoneIcon, PaperclipIcon, ReloadIcon,
    MonitorIcon, TabletIcon, SmartphoneIcon
} from './Icons';

import type { FileSystemState, ChatMessage, Container } from '../types';
import { chatWithAgent, getAiHint } from '../services/geminiService';
import * as containerService from '../services/containerService';
import { TEMPLATE_FILES } from '../constants';
import dbService from '../services/dbService';

const DEFAULT_FILES: FileSystemState = { ...TEMPLATE_FILES };

const INITIAL_CHAT_HISTORY: ChatMessage[] = [
    { id: 'init', role: 'system', content: 'Welcome System Operator. Create a new container or select an existing one to begin.' }
];

const liveEditScript = `
document.addEventListener('DOMContentLoaded', () => {
    // This script is injected into the preview iframe for live editing.
    // In a container-based app, direct DOM editing is less common, but this can be useful for static sites.
    if (window.frameElement) { 
        console.log("Live edit script loaded.");
    }
});
`;

type Viewport = 'desktop' | 'tablet' | 'mobile';

const EditorPanel: React.FC = () => {
    // Core application state
    const [isInitialized, setIsInitialized] = useState(false);
    const [fileSystem, setFileSystem] = useState<FileSystemState>(DEFAULT_FILES);
    const [containers, setContainers] = useState<Container[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(INITIAL_CHAT_HISTORY);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [aiHint, setAiHint] = useState('');
    const [previewRoot, setPreviewRoot] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false); // For container actions

    // Layout and UI state
    const [panelSizes, setPanelSizes] = useState([20, 45, 35]);
    const [rightPanelVerticalSplit, setRightPanelVerticalSplit] = useState(60); // Preview height %
    const [leftPanelVisible, setLeftPanelVisible] = useState(true);
    const [viewport, setViewport] = useState<Viewport>('desktop');

    // Modals
    const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
    const [saveAsFileName, setSaveAsFileName] = useState('');

    // Refs
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    const horizontalResizeRef = useRef<{ index: number, startX: number, initialSizes: number[] } | null>(null);
    const verticalResizeRef = useRef<{ startY: number, initialHeight: number } | null>(null);
    const rightPanelRef = useRef<HTMLDivElement>(null);

    const resolvePath = useCallback((relativePath: string, basePath: string): string => {
        const DUMMY_ORIGIN = 'http://localhost';
        const base = new URL(basePath.endsWith('/') ? basePath : `\${basePath}/`, DUMMY_ORIGIN);
        const resolved = new URL(relativePath, base);
        return resolved.pathname;
    }, []);
    
    const handleCodeChange = useCallback((path: string, content: string) => {
        setFileSystem(prev => ({ ...prev, [path]: content }));
    }, []);
    
    // --- Container & State Management ---

    const loadContainersFromFS = useCallback(() => {
        const loadedContainers = containerService.findContainers(fileSystem);
        setContainers(loadedContainers);
    }, [fileSystem]);


    // --- Core Logic: State Persistence ---
    const handleSaveState = useCallback(() => {
        if (!isInitialized) return;
        dbService.saveState({
            fileSystem, chatHistory, panelSizes, previewRoot, openFiles, activeFile, rightPanelVerticalSplit
        }).catch(err => console.error("Failed to save state:", err));
    }, [isInitialized, fileSystem, chatHistory, panelSizes, previewRoot, openFiles, activeFile, rightPanelVerticalSplit]);

    const handleLoadState = useCallback(async () => {
        try {
            await dbService.initDB();
            const savedState = await dbService.loadState();
            if (savedState && Object.keys(savedState.fileSystem).length > 0) {
                setFileSystem(savedState.fileSystem);
                setChatHistory(savedState.chatHistory.length > 0 ? savedState.chatHistory : INITIAL_CHAT_HISTORY);
                setPanelSizes(savedState.panelSizes);
                setPreviewRoot(savedState.previewRoot);
                setOpenFiles(savedState.openFiles);
                setActiveFile(savedState.activeFile);
                setRightPanelVerticalSplit(savedState.rightPanelVerticalSplit || 60);
            }
        } catch (err) {
            console.error("Failed to load state:", err);
        } finally {
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => {
        handleLoadState();
    }, [handleLoadState]);
    
    useEffect(() => {
        if(isInitialized) {
            loadContainersFromFS();
        }
    }, [isInitialized, fileSystem, loadContainersFromFS]);
    
    useEffect(() => {
        const handler = setTimeout(handleSaveState, 1000);
        return () => clearTimeout(handler);
    }, [handleSaveState]);

    // --- Core Logic: iFrame Preview ---
    const updateIframeContent = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        
        if (!previewRoot) {
            iframe.srcdoc = `<div style="font-family: sans-serif; color: #555; text-align: center; padding: 2rem;">Select a container and press 'Start' to preview it here.</div>`;
            return;
        }

        const htmlPath = `${previewRoot}index.html`;
        let htmlContent = fileSystem[htmlPath];
        
        if (!htmlContent) {
             iframe.srcdoc = `<div style="font-family: sans-serif; color: #933; text-align: center; padding: 2rem;">Error: <strong>index.html</strong> not found in container '${previewRoot}'.</div>`;
            return;
        }
        
        // In a real build system, a server would handle this. Here we simulate it.
        // For Vite/React apps, this preview will be limited as it doesn't run the dev server.
        // It's more of a static file previewer.
        const assetRegex = /(href|src)=["'](?!https?:\/\/|data:)([^"']+)["']/g;
        htmlContent = htmlContent.replace(assetRegex, (_, attr, path) => {
            const resolvedPath = path.startsWith('/') ? path : resolvePath(path, previewRoot);
            const content = fileSystem[resolvedPath];

            if (content) {
                let mimeType = 'text/plain';
                const extension = resolvedPath.split('.').pop()?.toLowerCase() || '';
                
                if (extension === 'css') mimeType = 'text/css';
                else if (['js', 'ts', 'tsx', 'mjs'].includes(extension)) mimeType = 'application/javascript';
                else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(extension)) mimeType = `image/${extension}`;

                const blob = new Blob([content], { type: mimeType });
                return `${attr}="${URL.createObjectURL(blob)}"`;
            }
            return `${attr}="${path}"`;
        });
        
        const scriptTag = `<script>${liveEditScript}</script>`;
        htmlContent = htmlContent.replace('</head>', `${scriptTag}</head>`);
        iframe.srcdoc = htmlContent;

    }, [fileSystem, previewRoot, resolvePath]);

    useEffect(() => {
        const timeoutId = setTimeout(updateIframeContent, 250);
        return () => clearTimeout(timeoutId);
    }, [updateIframeContent]);

    // --- Core Logic: Chat ---
    const handlePromptSubmit = async (prompt: string) => {
        if (!prompt.trim() || isAiThinking) return;

        const newUserMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt };
        const newHistory = [...chatHistory, newUserMessage];
        setChatHistory(newHistory);
        setPromptInput('');
        setIsAiThinking(true);
        setAiHint('');

        try {
            const result = await chatWithAgent(newHistory, fileSystem, previewRoot);
            const newModelMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                content: result.text,
                explanation: result.explanation,
                code: result.code,
            };
            setChatHistory(prev => [...prev, newModelMessage]);

            if (result.code) {
                handleApplyCode(result.code);
            }

        } catch (error) {
            console.error("Error with Gemini Agent:", error);
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'system',
                content: error instanceof Error ? error.message : "An unexpected error occurred.",
            };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsAiThinking(false);
        }
    };
    
    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        if (!isAiThinking && chatHistory.length > 1 && chatHistory[chatHistory.length - 1]?.role === 'model') {
            getAiHint(chatHistory).then(setAiHint);
        }
    }, [chatHistory, isAiThinking]);

    // --- Resizing Logic ---
    const handleHorizontalResizeStart = useCallback((index: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        horizontalResizeRef.current = { index, startX: e.clientX, initialSizes: [...panelSizes] };
        document.addEventListener('mousemove', handleHorizontalResizeMove);
        document.addEventListener('mouseup', handleHorizontalResizeEnd);
    }, [panelSizes]);

    const handleHorizontalResizeMove = useCallback((e: MouseEvent) => {
        if (!horizontalResizeRef.current) return;
        const { index, startX, initialSizes } = horizontalResizeRef.current;
        const deltaX = e.clientX - startX;
        const containerWidth = window.innerWidth;
        const deltaPercentage = (deltaX / containerWidth) * 100;
        
        const newSizes = [...initialSizes];
        const minSize = 10;

        let leftSize = newSizes[index] + deltaPercentage;
        let rightSize = newSizes[index + 1] - deltaPercentage;
        
        if (leftSize < minSize) {
            const diff = minSize - leftSize;
            leftSize = minSize;
            rightSize -= diff;
        }
        if (rightSize < minSize) {
            const diff = minSize - rightSize;
            rightSize = minSize;
            leftSize -= diff;
        }

        if (leftSize >= minSize && rightSize >= minSize) {
            newSizes[index] = leftSize;
            newSizes[index + 1] = rightSize;
            setPanelSizes(newSizes);
        }
    }, []);
    
    const handleHorizontalResizeEnd = useCallback(() => {
        horizontalResizeRef.current = null;
        document.removeEventListener('mousemove', handleHorizontalResizeMove);
        document.removeEventListener('mouseup', handleHorizontalResizeEnd);
    }, [handleHorizontalResizeMove]);

    const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        verticalResizeRef.current = { startY: e.clientY, initialHeight: rightPanelVerticalSplit };
        document.addEventListener('mousemove', handleVerticalResizeMove);
        document.addEventListener('mouseup', handleVerticalResizeEnd);
    }, [rightPanelVerticalSplit]);

    const handleVerticalResizeMove = useCallback((e: MouseEvent) => {
        if (!verticalResizeRef.current || !rightPanelRef.current) return;
        const { startY, initialHeight } = verticalResizeRef.current;
        const deltaY = e.clientY - startY;
        const containerHeight = rightPanelRef.current.clientHeight;

        if (containerHeight > 0) {
            const deltaPercentage = (deltaY / containerHeight) * 100;
            setRightPanelVerticalSplit(Math.max(10, Math.min(90, initialHeight + deltaPercentage)));
        }
    }, []);

    const handleVerticalResizeEnd = useCallback(() => {
        verticalResizeRef.current = null;
        document.removeEventListener('mousemove', handleVerticalResizeMove);
        document.removeEventListener('mouseup', handleVerticalResizeEnd);
    }, [handleVerticalResizeMove]);

    // --- Event Handlers: Files & UI ---
    const handleFileSelect = (path: string) => {
        if (fileSystem[path] !== undefined && !path.endsWith('/')) {
            setActiveFile(path);
            if (!openFiles.includes(path)) setOpenFiles([...openFiles, path]);
        }
    };
    
    const handleCloseFile = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newOpenFiles = openFiles.filter(p => p !== path);
        setOpenFiles(newOpenFiles);
        if (activeFile === path) {
            setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[0] : null);
        }
    };
    
    const handleApplyCode = (codeChanges: { path: string, content: string }[]) => {
        const updatedFs = { ...fileSystem };
        const updatedOpenFiles = new Set(openFiles);
        let firstFileToSelect: string | null = null;

        codeChanges.forEach(({ path, content }) => {
            updatedFs[path] = content;
            if(!path.endsWith('/.placeholder')) {
                updatedOpenFiles.add(path);
                if (!firstFileToSelect) firstFileToSelect = path;
            }
        });
        setFileSystem(updatedFs);
        setOpenFiles(Array.from(updatedOpenFiles));

        if (firstFileToSelect) {
            setActiveFile(firstFileToSelect);
        }
    };

    const downloadProject = () => {
        const zip = new JSZip();
        // Only zip up container files, not templates
        Object.entries(fileSystem).forEach(([path, content]) => {
            if (path.startsWith('/containers/')) {
                // remove '/containers/' from the path in the zip
                const zipPath = path.substring('/containers/'.length);
                zip.file(zipPath, content);
            }
        });
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = "live-dev-project.zip";
            link.click();
            URL.revokeObjectURL(link.href);
        });
    };

    const handleSaveAs = async () => { /* Logic to be implemented */ };

    // --- JSX Rendering Components ---
    const LeftPanel = () => (
        <div className="flex flex-col h-full bg-[var(--card-bg)] text-white p-2 gap-4 overflow-y-auto">
            <FileExplorer 
                fileSystem={fileSystem} activeFile={activeFile} previewRoot={previewRoot}
                onFileSelect={handleFileSelect} onSetPreviewRoot={setPreviewRoot}
                onNewFile={() => {}} onNewFolder={() => {}} onFileUpload={() => {}}
                onDownloadProject={downloadProject}
                onSaveAs={() => setIsSaveAsModalOpen(true)}
            />
            <SystemOperatorPanel
              containers={containers}
              setContainers={setContainers}
              fileSystem={fileSystem}
              setFileSystem={setFileSystem}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              setPreviewRoot={setPreviewRoot}
            />
        </div>
    );
    
    const EditorArea = () => (
         <div className="flex flex-col h-full bg-[#1e1e1e]">
            {openFiles.length > 0 && (
                <div className="flex-shrink-0 flex items-center bg-black/30 border-b border-[var(--card-border)] overflow-x-auto">
                    {openFiles.map(path => (
                        <button key={path} onClick={() => handleFileSelect(path)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-[var(--card-border)] whitespace-nowrap ${activeFile === path ? 'bg-[#1e1e1e] text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                            <span>{path.substring(path.lastIndexOf('/') + 1)}</span>
                            <span onClick={(e) => handleCloseFile(path, e)} className="p-1 rounded-full hover:bg-white/20"><XIcon className="h-4 w-4 text-gray-500 hover:text-white" /></span>
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-grow relative">
                {activeFile && fileSystem[activeFile] !== undefined ? (
                    <CodeEditor key={activeFile} value={fileSystem[activeFile]} language={activeFile.split('.').pop() || 'html'} onChange={(content) => handleCodeChange(activeFile, content)} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">Select a file to begin editing.</div>
                )}
            </div>
        </div>
    );

    const PreviewPanel = () => {
        const viewportStyles: Record<Viewport, React.CSSProperties> = {
            desktop: { width: '100%', height: '100%', border: 'none' },
            tablet: { width: '768px', height: '1024px', border: '1px solid #4a4a4a', boxShadow: '0 0 20px rgba(0,0,0,0.3)' },
            mobile: { width: '375px', height: '667px', border: '1px solid #4a4a4a', boxShadow: '0 0 20px rgba(0,0,0,0.3)' }
        };

        const ViewportButton: React.FC<{
            type: Viewport;
            icon: React.ReactNode;
            label: string;
        }> = ({ type, icon, label }) => (
            <button
                onClick={() => setViewport(type)}
                title={label}
                className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs ${viewport === type
                    ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                    : 'text-gray-400 hover:bg-black/40 hover:text-white'
                }`}
            >
                {icon}
            </button>
        );

        return (
            <div className="flex flex-col h-full bg-[#333] relative">
                <div className="flex-shrink-0 flex items-center justify-between p-2 bg-black border-b border-[var(--card-border)]">
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md">
                            <ViewportButton type="desktop" icon={<MonitorIcon className="h-4 w-4" />} label="Desktop" />
                            <ViewportButton type="tablet" icon={<TabletIcon className="h-4 w-4" />} label="Tablet" />
                            <ViewportButton type="mobile" icon={<SmartphoneIcon className="h-4 w-4" />} label="Mobile" />
                        </div>
                        <span className="text-xs font-semibold text-white hidden md:inline">{previewRoot ? `(Previewing ${previewRoot})` : '(No Preview Active)'}</span>
                    </div>
                    <button onClick={updateIframeContent} className="p-1.5 text-gray-400 hover:text-[var(--neon-green)] hover:bg-black/30 rounded" title="Refresh Preview">
                        <ReloadIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-grow w-full flex items-center justify-center overflow-auto p-4 bg-grid">
                     <iframe
                        ref={iframeRef}
                        title="Live Preview"
                        className="transition-all duration-300 ease-in-out bg-white"
                        style={viewportStyles[viewport]}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                </div>
            </div>
        );
    };

    const ChatPanel = () => (
        <div className="flex flex-col h-full bg-[var(--card-bg)] border-t-2 border-[var(--neon-purple)]">
            <header className="flex items-center justify-between p-2 bg-black/30 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-2"><GeminiIcon className="h-6 w-6 text-[var(--neon-purple)]" /><h2 className="font-bold text-lg">AI Assistant</h2></div>
            </header>
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
                {chatHistory.map(msg => <ChatMessageView key={msg.id} message={msg} onApplyCode={handleApplyCode} onSpeak={(text) => speechSynthesis.speak(new SpeechSynthesisUtterance(text))} />)}
                {isAiThinking && (
                    <div className="flex justify-start items-start gap-3 my-4">
                       <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 bg-[var(--neon-purple)] neon-glow-purple"><SpinnerIcon className="h-5 w-5 text-black animate-spin" /></div>
                       <div className="p-4 rounded-xl max-w-2xl bg-black/30 border border-[var(--neon-purple)] text-left text-gray-400 italic">The AI agents are working...</div>
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 p-3 border-t border-[var(--card-border)] bg-black/20">
                {aiHint && !isAiThinking && (
                     <button onClick={() => handlePromptSubmit(aiHint)} className="flex items-center gap-2 text-sm text-left w-full mb-2 p-2 bg-[var(--card-bg)] hover:bg-black/40 rounded-lg border border-[var(--card-border)]">
                        <LightbulbIcon className="h-4 w-4 text-[var(--neon-blue)] flex-shrink-0" /><span className="text-gray-300">{aiHint}</span>
                     </button>
                )}
                <div className="relative">
                    <textarea ref={promptInputRef} value={promptInput} onChange={(e) => setPromptInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit(promptInput); } }}
                        placeholder="Ask the AI to make changes..." rows={1} disabled={isAiThinking}
                        className="w-full bg-black/30 border border-[var(--neon-blue)] rounded-lg p-3 pr-36 text-white focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] resize-none" />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button className="p-1.5 hover:bg-white/10 rounded-full text-gray-300"><PaperclipIcon className="h-5 w-5"/></button>
                        <button className="p-1.5 hover:bg-white/10 rounded-full text-gray-300"><MicrophoneIcon className="h-5 w-5"/></button>
                        <button onClick={() => handlePromptSubmit(promptInput)} disabled={isAiThinking || !promptInput.trim()} className="p-2 bg-[var(--neon-blue)] hover:brightness-125 rounded-full text-black disabled:bg-gray-600 disabled:cursor-not-allowed">
                            <MagicWandIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isSaveAsModalOpen}
                onClose={() => setIsSaveAsModalOpen(false)}
                title="Save As"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-400">
                        Enter a new name for your page. Associated CSS and JS files will be copied and renamed automatically. Current file: <strong>{activeFile}</strong>
                    </p>
                    <input
                        type="text"
                        value={saveAsFileName}
                        onChange={(e) => setSaveAsFileName(e.target.value)}
                        placeholder="e.g., 'about-page' or 'contact'"
                        className="w-full bg-black/30 border border-[var(--neon-purple)] rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--neon-purple)]"
                    />
                    <button
                        onClick={handleSaveAs}
                        disabled={!saveAsFileName.trim() || !activeFile?.endsWith('.html')}
                        className="flex items-center gap-2 w-full justify-center text-sm bg-[var(--neon-green)] hover:brightness-125 text-black font-bold py-2.5 px-3 rounded-md transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        <span>Save as New Page</span>
                    </button>
                </div>
            </Modal>

            <div className="flex h-full w-full overflow-hidden">
                {leftPanelVisible && (
                    <>
                        <div style={{ flexBasis: `${panelSizes[0]}%` }} className="flex-shrink-0 h-full">
                            <LeftPanel />
                        </div>
                        <div className="resize-handle" onMouseDown={handleHorizontalResizeStart(0)}></div>
                    </>
                )}
                
                <div style={{ flexBasis: leftPanelVisible ? `${panelSizes[1]}%` : `${panelSizes[0] + panelSizes[1]}%` }} className="h-full flex flex-col">
                    <EditorArea />
                </div>
                
                <div className="resize-handle" onMouseDown={handleHorizontalResizeStart(1)}></div>
                
                <div ref={rightPanelRef} style={{ flexBasis: `${panelSizes[2]}%` }} className="h-full flex flex-col">
                    <div style={{ flexBasis: `${rightPanelVerticalSplit}%` }} className="w-full relative overflow-hidden">
                        <PreviewPanel />
                    </div>
                    <div className="w-full h-[6px] bg-[var(--neon-blue)] cursor-row-resize transition-all opacity-50 hover:opacity-100 z-10 flex-shrink-0"
                        onMouseDown={handleVerticalResizeStart}>
                    </div>
                    <div className="w-full relative flex-grow overflow-hidden">
                         <ChatPanel />
                    </div>
                </div>
            </div>
        </>
    );
};

export default EditorPanel;
