import { TEMPLATE_REGISTRY, TEMPLATE_FILES } from '../constants';
import type { Container, FileSystemState, HandoverLog } from '../types';

/**
 * Finds all container definitions within a file system by looking for handover.json files.
 */
export function findContainers(fileSystem: FileSystemState): Container[] {
    const containers: Container[] = [];
    for (const path in fileSystem) {
        if (path.endsWith('/handover.json')) {
            try {
                const container = JSON.parse(fileSystem[path]);
                containers.push(container);
            } catch (e) {
                console.error(`Failed to parse handover.json at ${path}`, e);
            }
        }
    }
    return containers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function deepMerge(target: any, source: any) {    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], deepMerge(target[key], source[key]));
            }
        }
    }
    Object.assign(target || {}, source);
    return target;
}


/**
 * Creates a new container by copying template files into a new directory.
 */
export function createContainer(
    options: {
        prompt: string;
        base: string;
        ui: string[];
        datastore?: string;
    },
    existingFileSystem: FileSystemState
): { newFileSystem: FileSystemState; newContainer: Container } {
    const { prompt, base, ui, datastore } = options;
    const newId = `cntr_${crypto.randomUUID().split('-')[0]}`;
    const newPath = `/containers/${newId}/`;

    const newFileSystem: FileSystemState = { ...existingFileSystem };
    let finalPackageJson: any = {};

    const templatesToApply = [base, ...ui, datastore].filter(Boolean) as string[];

    for (const templateId of templatesToApply) {
        const allTemplates = [...TEMPLATE_REGISTRY.base, ...TEMPLATE_REGISTRY.ui, ...TEMPLATE_REGISTRY.datastore];
        const template = allTemplates.find(t => t.id === templateId);
        if (!template) {
            console.warn(`Template with id ${templateId} not found.`);
            continue;
        }

        // Find all files for this template
        for (const filePath in TEMPLATE_FILES) {
            if (filePath.startsWith(template.path)) {
                const relativePath = filePath.substring(template.path.length + 1);
                const newFilePath = `${newPath}${relativePath}`;
                
                // Special handling for package.json to merge dependencies
                if (relativePath === 'package.json') {
                    try {
                        const templatePkg = JSON.parse(TEMPLATE_FILES[filePath]);
                        finalPackageJson = deepMerge(finalPackageJson, templatePkg);
                    } catch(e) { console.error("Failed to parse package.json", e); }
                    continue;
                }
                
                 // Overwrite files like App.tsx from enhancements
                newFileSystem[newFilePath] = TEMPLATE_FILES[filePath];
            }
        }
    }

    newFileSystem[`${newPath}package.json`] = JSON.stringify(finalPackageJson, null, 2);

    const initialLog: HandoverLog = {
        action: 'create',
        by: 'system_operator',
        at: new Date().toISOString(),
        details: { prompt, templates: templatesToApply },
    };

    const newContainer: Container = {
        id: newId,
        operator: 'system_operator',
        prompt,
        status: 'initialized',
        createdAt: new Date().toISOString(),
        path: newPath,
        chosenTemplates: { base, ui, datastore },
        history: [initialLog],
    };

    newFileSystem[`${newPath}handover.json`] = JSON.stringify(newContainer, null, 2);

    return { newFileSystem, newContainer };
}

function updateContainerFile(container: Container, fileSystem: FileSystemState): FileSystemState {
    const handoverPath = `${container.path}handover.json`;
    return {
        ...fileSystem,
        [handoverPath]: JSON.stringify(container, null, 2),
    };
}


/**
 * Simulates running a command on a container.
 */
export async function runCommand(
    container: Container,
    command: 'install' | 'build' | 'start' | 'debug',
    fileSystem: FileSystemState,
): Promise<{ updatedContainer: Container, updatedFileSystem: FileSystemState }> {

    let updatedContainer = { ...container };
    let log: HandoverLog = {
        action: 'command',
        by: 'system_operator',
        at: new Date().toISOString(),
        details: { command, status: 'pending' },
    };

    const startStatus = command === 'install' ? 'installing' : 'building';
    updatedContainer.status = startStatus;
    updatedContainer.history.push(log);
    
    // Simulate async operation
    await new Promise(res => setTimeout(res, 1500 + Math.random() * 1500));

    // Update status based on command
    let finalStatus: Container['status'] = 'error';
    if(command === 'install') {
        finalStatus = 'installed';
    } else if(command === 'build') {
        finalStatus = 'built';
    } else if(command === 'start') {
        finalStatus = 'running';
    }
    
    log.details.status = 'success';
    updatedContainer.status = finalStatus;

    const updatedFileSystem = updateContainerFile(updatedContainer, fileSystem);
    
    return { updatedContainer, updatedFileSystem };
}

/**
 * Deletes a container and all its files.
 */
export function deleteContainer(
    containerId: string,
    fileSystem: FileSystemState
): FileSystemState {
    const newFileSystem = { ...fileSystem };
    const containerPath = `/containers/${containerId}/`;
    
    for (const path in newFileSystem) {
        if (path.startsWith(containerPath)) {
            delete newFileSystem[path];
        }
    }
    
    return newFileSystem;
}