import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AuthGate from './components/AuthGate.jsx';
import StudentSignupPage from './components/StudentSignupPage.jsx';
import './styles.css';
import './studentSignup.css';

const isStudentSignupRoute = window.location.pathname.replace(/\/+$/, '') === '/inscricao';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isStudentSignupRoute ? <StudentSignupPage /> : <AuthGate><App /></AuthGate>}
  </React.StrictMode>,
);
