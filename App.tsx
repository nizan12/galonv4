import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from '@firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, AppSettings } from './types';
import { ToastProvider } from './context/ToastContext';

import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TukangGalonDashboard from './pages/TukangGalonDashboard';
import Profile from './pages/Profile';
import Layout from './components/Layout';

interface AppContextType {
  user: UserProfile | null;
  settings: AppSettings | null;
  loading: boolean;
}

const AppContext = createContext<AppContextType>({ user: null, settings: null, loading: true });
export const useApp = () => useContext(AppContext);

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for global settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const userDocRef = doc(db, 'users', authUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUser({ ...userDoc.data(), uid: authUser.uid } as UserProfile);
          } else {
            const isDefaultAdmin = authUser.email === 'admin@aqua.com';
            const newUser: UserProfile = {
              uid: authUser.uid,
              email: authUser.email || '',
              displayName: isDefaultAdmin ? 'Super Admin' : (authUser.displayName || 'New User'),
              role: isDefaultAdmin ? 'admin' : 'student',
              roomId: null,
              turnOrder: 0,
              bypassQuota: 3,
              maxBypassQuota: 3,
              skipCredits: 0,
              bypassDebt: 0,
              lastQuotaReset: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
              status: 'aktif'
            };
            await setDoc(userDocRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (user && user.role === 'student') {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

      if (user.lastQuotaReset !== currentMonthKey) {
        const resetQuota = async () => {
          const userRef = doc(db, 'users', user.uid);
          const updatedData = {
            bypassQuota: user.maxBypassQuota || 3,
            lastQuotaReset: currentMonthKey
          };
          await updateDoc(userRef, updatedData);
          setUser(prev => prev ? { ...prev, ...updatedData } : null);
        };
        resetQuota();
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 border-solid"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Memuat Profil...</p>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    if (!user) return null;
    switch (user.role) {
      case 'admin': return <AdminDashboard />;
      case 'tukang_galon': return <TukangGalonDashboard user={user} />;
      default: return <StudentDashboard user={user} />;
    }
  };

  return (
    <AppContext.Provider value={{ user, settings, loading }}>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
            <Route
              path="/"
              element={
                user ? (
                  <Layout user={user}>
                    {renderDashboard()}
                  </Layout>
                ) : <Navigate to="/login" replace />
              }
            />
            <Route
              path="/profile"
              element={
                user ? <Layout user={user}><Profile user={user} onUpdate={(updated) => setUser(updated)} /></Layout> : <Navigate to="/login" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AppContext.Provider>
  );
};

export default App;