import React, { lazy, Suspense } from 'react';

const DemoApp = lazy(() => import('./DemoApp'));
const AuthApp = lazy(() => import('./AuthApp'));
const authPaths = new Set(['/mobile-auth', '/login', '/register', '/forgot-password', '/reset-password']);

export default function App() {
  const Page = authPaths.has(window.location.pathname.replace(/\/$/, '')) ? AuthApp : DemoApp;
  return <Suspense fallback={<p>Loading GroomerGo…</p>}><Page /></Suspense>;
}
