
import React, { useState, useEffect } from 'react';
import { GithubIcon } from './components/Icons';
import EditorPanel from './components/AgentsPanel';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import LoginPage from './components/LoginPage';

type View = 'app' | 'terms' | 'privacy';

// Mock user data for display after login
const MOCK_USER = {
  name: 'CodeWizard',
  avatarUrl: 'https://github.com/github.png?size=40'
};


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('app');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check session storage for login state on initial load
  useEffect(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  // Add/remove landing page background class from body
  useEffect(() => {
    if (!isLoggedIn) {
        document.body.classList.add('landing-background');
    } else {
        document.body.classList.remove('landing-background');
    }
    // Cleanup on component unmount
    return () => document.body.classList.remove('landing-background');
  }, [isLoggedIn]);


  const handleLogin = () => {
    setIsLoggedIn(true);
    sessionStorage.setItem('isLoggedIn', 'true');
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('isLoggedIn');
    setCurrentView('app'); // Ensure we show the login page after logout
  };

  const AppHeader = () => (
    <header className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border-b border-[var(--card-border)]">
      <div className="flex items-center gap-4">
        <a href="#" className="flex items-center gap-2 text-xl font-bold text-white">
          <img src="https://andiegogiap.com/assets/favicon.ico" alt="Aionex Logo" className="h-8 w-8" />
          <span>AIONEX</span>
        </a>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">Logout</button>
        <img src={MOCK_USER.avatarUrl} alt="User Avatar" className="h-8 w-8 rounded-full" />
      </div>
    </header>
  );

  const AppFooter = () => (
    <footer className="text-center p-4 text-xs text-gray-500">
      &copy; {new Date().getFullYear()} AIONEX. All rights reserved. |
      <button onClick={() => setCurrentView('terms')} className="mx-2 hover:text-[var(--neon-blue)]">Terms of Service</button> |
      <button onClick={() => setCurrentView('privacy')} className="mx-2 hover:text-[var(--neon-blue)]">Privacy Policy</button>
    </footer>
  );
  
  if (!isLoggedIn) {
      return (
          <div className="flex flex-col min-h-screen">
              <LoginPage onLogin={handleLogin} />
          </div>
      );
  }

  const renderView = () => {
    switch(currentView) {
      case 'terms':
        return <TermsOfService onClose={() => setCurrentView('app')} />;
      case 'privacy':
        return <PrivacyPolicy onClose={() => setCurrentView('app')} />;
      case 'app':
      default:
        return (
          <div className="flex flex-col h-screen bg-[var(--dark-bg)]">
            <AppHeader />
            <main className="flex-grow overflow-hidden">
              <EditorPanel />
            </main>
          </div>
        );
    }
  };

  const MainAppView = (
     <div className="flex flex-col h-screen bg-[var(--dark-bg)]">
        <AppHeader />
        <main className="flex-grow overflow-hidden">
          <EditorPanel />
        </main>
      </div>
  )

  const renderContent = () => {
      switch (currentView) {
          case 'terms':
              return <TermsOfService onClose={() => setCurrentView('app')} />;
          case 'privacy':
              return <PrivacyPolicy onClose={() => setCurrentView('app')} />;
          case 'app':
          default:
              return MainAppView;
      }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow">
        {renderContent()}
      </div>
      {currentView === 'app' && <AppFooter />}
    </div>
  );
};

export default App;
