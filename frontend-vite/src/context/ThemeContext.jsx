import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system');

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved) setTheme(saved);
  }, []);

  // Save preference
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    applyTheme(theme);
  }, [theme]);

  function applyTheme(t) {
    const root = document.documentElement;
    const isDark =
      t === 'dark' ||
      (t === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.style.setProperty('--bg', isDark ? '#0b0f1a' : '#ffffff');
    root.style.setProperty('--card', isDark ? '#121826' : '#f3f4f6');
    root.style.setProperty('--text', isDark ? '#e6eefc' : '#111827');
    root.style.setProperty('--muted', isDark ? '#9fb3d1' : '#6b7280');
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
