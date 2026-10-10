import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MobileAuthCallback from './pages/MobileAuthCallback';
import { Toaster } from './components/ui/toaster';
import './auth.css';

export default function AuthApp() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/mobile-auth" element={<MobileAuthCallback />} />
  </Routes><Toaster /></BrowserRouter>;
}
