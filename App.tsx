import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import type { User, AppView } from './types';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import DashboardPage from './components/DashboardPage';
import ResumeInterviewPage from './components/ResumeInterviewPage';
import McqTestPage from './components/McqTestPage';
import { LogoutIcon, Spinner, SunIcon, MoonIcon } from './components/icons';
import { isApiKeyConfigured } from './services/geminiService';

type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark'; // Default for server-side rendering
  }
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return userPrefersDark ? 'dark' : 'light';
};

const getInitialView = (): AppView => {
  // If the user was on the auth page, keep them there on refresh.
  // Otherwise, default to the landing page for logged-out users.
  const savedView = sessionStorage.getItem('appView');
  if (savedView === 'auth') {
    return 'auth';
  }
  return 'landing';
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(getInitialView);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [apiKeyStatus, setApiKeyStatus] = useState(false);

  useEffect(() => {
    // Check the API key status once on initial load.
    setApiKeyStatus(isApiKeyConfigured());
  }, []);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Create a single, memoized setView function to pass down to children.
  // This function also handles persisting the 'auth' view to sessionStorage.
  const handleSetView = useCallback((newView: AppView) => {
    if (newView === 'auth') {
      sessionStorage.setItem('appView', newView);
    } else {
      // We only want to persist the 'auth' view. Clear for any other view.
      sessionStorage.removeItem('appView');
    }
    setView(newView);
  }, []);

  useEffect(() => {
    // This listener handles Firebase's session management.
    // It runs on initial load and whenever the user's auth state changes.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // If a user session is found (e.g., from a previous login),
        // set the user state and navigate to the dashboard.
        setUser({
          name: firebaseUser.displayName || firebaseUser.email || 'User',
          email: firebaseUser.email || '',
        });
        sessionStorage.removeItem('appView'); // Clean up on login
        setView('dashboard');
      } else {
        // If no user is found, clear the user state.
        setUser(null);
        // If user logs out from an authenticated page, send them to landing.
        // The initial state already handles the refresh case correctly.
        setView(currentView => {
          if (currentView !== 'landing' && currentView !== 'auth') {
            return 'landing';
          }
          return currentView;
        });
      }
      setAuthLoading(false);
    });

    // Clean up the listener when the component unmounts.
    return () => unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('appView');
      // The onAuthStateChanged listener will handle setting the view to 'landing'
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  }, []);
  
  const toggleTheme = () => {
      setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleEndSession = useCallback(() => {
    handleSetView('dashboard');
  }, [handleSetView]);

  const renderHeader = () => {
    return (
      <header className="absolute top-0 right-0 p-4 z-30">
        <div className="flex items-center space-x-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-md">
          {user && !authLoading && (
            <>
              <span className="text-slate-700 dark:text-slate-300 font-medium text-sm pr-2 pl-3 hidden sm:block">{user.name}</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium text-sm pr-2 pl-3 sm:hidden">{user.name.split(' ')[0]}</span>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 p-2 rounded-full transition-colors w-9 h-9"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <MoonIcon className="w-5 h-5 text-slate-700" /> : <SunIcon className="w-5 h-5 text-slate-300" />}
          </button>

          {user && !authLoading && (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 p-2 rounded-full transition-colors w-9 h-9"
              aria-label="Logout"
            >
              <LogoutIcon className="w-5 h-5 text-slate-700 dark:text-slate-400" />
            </button>
          )}
        </div>
      </header>
    );
  };

  const renderContent = () => {
    if (authLoading) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-slate-900">
          <Spinner />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Authenticating...</p>
        </div>
      );
    }
    
    if (!user) {
        if (view === 'landing') {
            return <LandingPage setView={handleSetView} />;
        }
        return <AuthPage setView={handleSetView} />;
    }

    switch (view) {
      case 'dashboard':
        return <DashboardPage username={user.name} setView={handleSetView} isApiKeyConfigured={apiKeyStatus} />;
      case 'resume-interview':
        return <ResumeInterviewPage onEndSession={handleEndSession} />;
      case 'mcq-test':
        return <McqTestPage onEndSession={handleEndSession} />;
      default:
         // Fallback to dashboard if logged in with an unknown view
         return <DashboardPage username={user.name} setView={handleSetView} isApiKeyConfigured={apiKeyStatus} />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white relative min-h-screen transition-colors duration-300">
      {renderHeader()}
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
