import React, { useState } from 'react';
import type { Container, FileSystemState, Template } from '../types';
import { TEMPLATE_REGISTRY } from '../constants';
import * as containerService from '../services/containerService';
import { ContainerIcon, PlusIcon, SpinnerIcon, PlayIcon, CheckIcon, XIcon, UsersIcon } from './Icons';
import CollapsibleSection from './CollapsibleSection';
import Modal from './Modal';

interface SystemOperatorPanelProps {
    containers: Container[];
    setContainers: React.Dispatch<React.SetStateAction<Container[]>>;
    fileSystem: FileSystemState;
    setFileSystem: React.Dispatch<React.SetStateAction<FileSystemState>>;
    isProcessing: boolean;
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
    setPreviewRoot: (path: string | null) => void;
}

const CreateContainerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onContainerCreate: (newFs: FileSystemState, newContainer: Container) => void;
    fileSystem: FileSystemState;
}> = ({ isOpen, onClose, onContainerCreate, fileSystem }) => {
    const [prompt, setPrompt] = useState('');
    const [base, setBase] = useState<string>(TEMPLATE_REGISTRY.base[0]?.id || '');
    const [ui, setUi] = useState<string[]>([]);
    const [datastore, setDatastore] = useState<string>('');
    const [apiName, setApiName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showEnv, setShowEnv] = useState(false);

    const handleCreate = () => {
        const env: { [key: string]: string } = {};
        if (apiName.trim()) env['API_NAME'] = apiName.trim();
        if (apiKey.trim()) env['API_KEY'] = apiKey.trim();

        const { newFileSystem, newContainer } = containerService.createContainer({
            prompt,
            base,
            ui,
            datastore,
            env,
        }, fileSystem);
        onContainerCreate(newFileSystem, newContainer);
        onClose();
        // Reset form
        setPrompt('');
        setUi([]);
        setDatastore('');
        setApiName('');
        setApiKey('');
        setShowEnv(false);
    };

    const TemplateSelector: React.FC<{
        title: string;
        templates: Template[];
        selection: string | string[];
        onChange: (id: string) => void;
        isMulti?: boolean;
    }> = ({ title, templates, selection, onChange, isMulti = false }) => (
        <div>
            <h3 className="font-semibold text-gray-300 mb-2">{title}</h3>
            <div className="space-y-2">
                {templates.map(template => {
                    const isSelected = isMulti ? (selection as string[]).includes(template.id) : selection === template.id;
                    return (
                        <button key={template.id} onClick={() => onChange(template.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${isSelected ? 'bg-green-500/10 border-green-500' : 'bg-black/20 border-gray-600 hover:border-gray-500'}`}>
                            <p className="font-bold text-white">{template.name}</p>
                            <p className="text-xs text-gray-400">{template.description}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Build Container">
            <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400">
                    Bootstrap a new application by selecting templates from the registry.
                </p>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe your goal (e.g., 'A to-do list app')"
                    rows={2}
                    className="w-full bg-black/30 border border-[var(--neon-purple)] rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--neon-purple)]"
                />
                
                <TemplateSelector title="Base Template" templates={TEMPLATE_REGISTRY.base} selection={base} onChange={setBase} />
                <TemplateSelector title="UI Library (Optional)" templates={TEMPLATE_REGISTRY.ui} selection={ui} onChange={(id) => setUi(u => u.includes(id) ? u.filter(i => i !== id) : [...u, id])} isMulti />
                <TemplateSelector title="Datastore (Optional)" templates={TEMPLATE_REGISTRY.datastore} selection={datastore} onChange={(id) => setDatastore(d => d === id ? '' : id)} />
                
                <div>
                    <button onClick={() => setShowEnv(!showEnv)} className="w-full flex justify-between items-center p-2 font-semibold text-gray-300 bg-black/20 hover:bg-black/40 transition-colors rounded-t-lg">
                        <span>Environment Variables (Optional)</span>
                        <svg className={`w-4 h-4 transform transition-transform ${showEnv ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showEnv && (
                        <div className="p-3 bg-black/20 rounded-b-lg space-y-3">
                            <input
                                type="text"
                                value={apiName}
                                onChange={(e) => setApiName(e.target.value)}
                                placeholder="API_NAME"
                                className="w-full bg-black/30 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-[var(--neon-purple)]"
                            />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="API_KEY"
                                className="w-full bg-black/30 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-[var(--neon-purple)]"
                            />
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!base}
                    className="flex items-center gap-2 w-full justify-center text-sm bg-[var(--neon-green)] hover:brightness-125 text-black font-bold py-2.5 px-3 rounded-md transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <UsersIcon className="h-4 w-4" />
                    <span>Create Container</span>
                </button>
            </div>
        </Modal>
    );
};

const ContainerCard: React.FC<{
    container: Container;
    onCommand: (id: string, command: 'install' | 'build' | 'start' | 'debug') => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
    setPreviewRoot: (path: string | null) => void;
}> = ({ container, onCommand, onDelete, isProcessing, setPreviewRoot }) => {
    
    const statusColors: Record<Container['status'], string> = {
        initialized: 'border-gray-500 text-gray-400',
        installing: 'border-blue-500 text-blue-400 animate-pulse',
        installed: 'border-blue-400 text-blue-300',
        building: 'border-yellow-500 text-yellow-400 animate-pulse',
        built: 'border-yellow-400 text-yellow-300',
        running: 'border-green-500 text-green-400',
        error: 'border-red-500 text-red-400',
    };

    const ActionButton: React.FC<{
        label: string;
        onClick: () => void;
        disabled: boolean;
        command: 'install' | 'build' | 'start' | 'debug';
    }> = ({ label, onClick, disabled, command }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex-1 text-xs font-bold py-1 px-2 rounded bg-black/30 hover:bg-black/50 disabled:bg-black/20 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
        >
            {isProcessing && container.status.startsWith(command.slice(0, 4)) ? <SpinnerIcon className="h-4 w-4 mx-auto animate-spin" /> : label}
        </button>
    );

    return (
        <div className="bg-black/20 p-3 rounded-lg border border-white/10">
            <div className="flex justify-between items-start">
                <div>
                    <div className={`inline-flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded-full border ${statusColors[container.status]}`}>
                        <span className="capitalize">{container.status}</span>
                    </div>
                    <p className="text-sm font-semibold mt-2">{container.prompt || 'Untitled Build'}</p>
                    <p className="text-xs text-gray-500 font-mono">{container.id}</p>
                </div>
                <button onClick={() => onDelete(container.id)} className="p-1 text-gray-500 hover:text-red-500"><XIcon className="h-4 w-4" /></button>
            </div>

            {container.env && Object.keys(container.env).length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 text-xs space-y-1">
                    {Object.entries(container.env).map(([key, value]) => (
                        <div key={key} className="flex justify-between font-mono">
                            <span className="text-gray-400">{key}:</span>
                            <span className="text-gray-200 truncate ml-2" title={key === 'API_KEY' ? 'API Key is hidden' : value}>
                                {key === 'API_KEY' ? '••••••••' : value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 mt-3">
                <ActionButton label="Install" onClick={() => onCommand(container.id, 'install')} disabled={isProcessing || container.status !== 'initialized'} command="install" />
                <ActionButton label="Build" onClick={() => onCommand(container.id, 'build')} disabled={isProcessing || container.status !== 'installed'} command="build" />
                <ActionButton label="Start" onClick={() => onCommand(container.id, 'start')} disabled={isProcessing || !['built', 'installed'].includes(container.status)} command="start" />
            </div>
             {container.status === 'running' && (
                <button onClick={() => setPreviewRoot(container.path)} className="w-full mt-2 text-xs font-bold py-1.5 px-2 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2">
                    <PlayIcon className="h-4 w-4" /> Set as Preview
                </button>
            )}
        </div>
    );
};

const SystemOperatorPanel: React.FC<SystemOperatorPanelProps> = (props) => {
    const { containers, setContainers, fileSystem, setFileSystem, isProcessing, setIsProcessing, setPreviewRoot } = props;
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const handleContainerCreate = (newFs: FileSystemState, newContainer: Container) => {
        setFileSystem(newFs);
        setContainers(prev => [newContainer, ...prev]);
    };

    const handleCommand = async (id: string, command: 'install' | 'build' | 'start' | 'debug') => {
        const container = containers.find(c => c.id === id);
        if (!container) return;
        
        setIsProcessing(true);
        const { updatedContainer, updatedFileSystem } = await containerService.runCommand(container, command, fileSystem);
        setFileSystem(updatedFileSystem);
        setContainers(prev => prev.map(c => c.id === id ? updatedContainer : c));
        
        if (command === 'start') {
            setPreviewRoot(updatedContainer.path);
        }
        setIsProcessing(false);
    };

    const handleDelete = (id: string) => {
        if (!window.confirm(`Are you sure you want to delete container ${id}? This cannot be undone.`)) return;
        const newFs = containerService.deleteContainer(id, fileSystem);
        setFileSystem(newFs);
        setContainers(prev => prev.filter(c => c.id !== id));
        setPreviewRoot(null);
    };

    return (
        <>
            <CreateContainerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onContainerCreate={handleContainerCreate} fileSystem={fileSystem} />
            <CollapsibleSection title="System Operator">
                <div className="flex flex-col gap-3">
                    <button onClick={() => setIsModalOpen(true)} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[var(--neon-blue)]/20 hover:bg-[var(--neon-blue)]/30 text-[var(--neon-blue)] font-bold rounded-lg border-2 border-dashed border-[var(--neon-blue)]/50 transition-colors">
                        <PlusIcon className="h-5 w-5" />
                        <span>Create New Container</span>
                    </button>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {containers.length === 0 && (
                            <p className="text-xs text-center text-gray-500 p-4">No containers found. Create one to get started.</p>
                        )}
                        {containers.map(c => (
                            <ContainerCard key={c.id} container={c} onCommand={handleCommand} onDelete={handleDelete} isProcessing={isProcessing} setPreviewRoot={setPreviewRoot} />
                        ))}
                    </div>
                </div>
            </CollapsibleSection>
        </>
    );
};

export default SystemOperatorPanel;