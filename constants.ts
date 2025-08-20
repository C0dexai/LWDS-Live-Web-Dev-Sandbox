import type { Template } from './types';

export const TEMPLATE_REGISTRY: { base: Template[], ui: Template[], datastore: Template[] } = {
  base: [
    {
      id: 'react-vite',
      name: 'React + Vite',
      type: 'base',
      path: '/templates/react-vite',
      description: 'A modern React setup with Vite for lightning-fast development.'
    },
  ],
  ui: [
    {
      id: 'tailwind-css',
      name: 'Tailwind CSS',
      type: 'ui',
      path: '/templates/tailwind-css',
      description: 'A utility-first CSS framework for rapid UI development.'
    },
  ],
  datastore: [
    {
      id: 'indexeddb',
      name: 'IndexedDB',
      type: 'datastore',
      path: '/templates/datastore/indexeddb',
      description: 'Browser-based key-value store for client-side data persistence.'
    },
  ],
};

export const TEMPLATE_FILES: Record<string, string> = {
  // React + Vite Base Template
  '/templates/react-vite/package.json': `{
  "name": "react-vite-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "typescript": "^5.0.2",
    "vite": "^4.4.5"
  }
}`,
  '/templates/react-vite/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  '/templates/react-vite/vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`,
  '/templates/react-vite/tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
  '/templates/react-vite/tsconfig.node.json': `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`,
  '/templates/react-vite/src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  '/templates/react-vite/src/App.tsx': `import React from 'react';

function App() {
  return (
    <div className="app-container">
      <h1>Welcome to Your New App!</h1>
      <p>This is a starter application built with React and Vite.</p>
    </div>
  )
}

export default App`,
  '/templates/react-vite/src/index.css': `body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #242424;
  color: rgba(255, 255, 255, 0.87);
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
`,

  // Tailwind CSS UI Template
  '/templates/tailwind-css/tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
  '/templates/tailwind-css/postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
  '/templates/tailwind-css/src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
  '/templates/tailwind-css/src/App.tsx': `import React from 'react';

function App() {
  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4 animate-pulse">Hello, Tailwind!</h1>
      <p className="text-xl text-gray-400">Your application is now styled with Tailwind CSS.</p>
      <button className="mt-8 px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
        Get Started
      </button>
    </div>
  )
}

export default App`,

  // IndexedDB Datastore Template
  '/templates/datastore/indexeddb/src/lib/db.ts': `// A simple IndexedDB helper
const DB_NAME = 'MyAppData';
const DB_VERSION = 1;
const STORE_NAME = 'items';

let db: IDBDatabase;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', request.error);
      reject('Database error');
    };

    request.onsuccess = (event) => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
  });
}

export async function addItem<T>(item: Omit<T, 'id'>): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(item);
    
    transaction.oncomplete = () => {
      // The added item now has an ID assigned by the database
      resolve({ ...item, id: request.result } as T);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

export async function getAllItems<T>(): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    transaction.oncomplete = () => {
      resolve(request.result);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}
`,
  '/templates/datastore/indexeddb/src/App.tsx': `import React, { useState, useEffect } from 'react';
import { addItem, getAllItems } from './lib/db';

interface ToDoItem {
  id: number;
  text: string;
  createdAt: number;
}

function App() {
  const [items, setItems] = useState<ToDoItem[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    async function loadItems() {
      const storedItems = await getAllItems<ToDoItem>();
      setItems(storedItems);
    }
    loadItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    const addedItem = await addItem<ToDoItem>({ text: newItem, createdAt: Date.now() });
    setItems(prev => [...prev, addedItem]);
    setNewItem('');
  };

  return (
    <div className="bg-gray-800 text-white min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-6">IndexedDB To-Do List</h1>
      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-grow p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700">
          Add
        </button>
      </form>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.id} className="p-3 bg-gray-700 rounded-lg">
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App`,
};
