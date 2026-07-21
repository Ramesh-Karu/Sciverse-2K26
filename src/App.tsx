/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RegistrationPage from './pages/RegistrationPage';
import SchoolDashboard from './pages/SchoolDashboard';
import AdminDashboard from './pages/AdminDashboard';
import FeedbackPage from './pages/FeedbackPage';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/dashboard" element={<SchoolDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/feedback" element={<FeedbackPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
