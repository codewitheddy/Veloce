import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './utils/contrastAudit.ts';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { AppStoreProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { QueryProvider } from './providers/QueryProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <LanguageProvider>
          <AppStoreProvider>
            <App />
          </AppStoreProvider>
        </LanguageProvider>
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
);


