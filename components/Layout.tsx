import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from '@firebase/auth';
import { UserProfile } from '../types';
import { useApp } from '../App';

interface LayoutProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, children }) => {
  const navigate = useNavigate();
  const { settings } = useApp();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 px-3 md:px-4 pt-3 md:pt-4">
        <nav className="max-w-7xl mx-auto glass rounded-2xl md:rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white/80 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center transition-all">
          <Link to="/" className="flex items-center space-x-2 md:space-x-3 group">
            <div className={`transition-transform group-hover:scale-110 flex items-center justify-center overflow-hidden h-9 w-9 md:h-11 md:w-11 ${!settings?.logoUrl ? 'bg-slate-900 p-2 md:p-2.5 rounded-xl md:rounded-2xl shadow-lg shadow-slate-200' : ''}`}>
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Logo" />
              ) : (
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm md:text-lg tracking-tight text-slate-900 leading-tight">AquaSchedule</span>
              <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Smart Dormitory</span>
            </div>
          </Link>

          <div className="flex items-center space-x-2 md:space-x-6">
            {user && (
              <Link to="/profile" className="flex items-center space-x-2 md:space-x-3 hover:bg-slate-50/50 p-1 pr-2 md:pr-4 rounded-xl md:rounded-2xl transition-all group">
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg group-hover:rotate-6 transition-transform shrink-0">
                  <div className="h-full w-full rounded-[0.5rem] md:rounded-[0.9rem] bg-white flex items-center justify-center overflow-hidden">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-600 font-black text-xs md:text-sm">{user.displayName?.charAt(0) || '?'}</span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs md:text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-none">{user.displayName}</span>
                  <span className="text-[7px] md:text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1 leading-none">{user.role}</span>
                </div>
              </Link>
            )}
            <button 
              onClick={handleLogout}
              className="bg-slate-50/80 hover:bg-red-50 text-slate-400 hover:text-red-600 p-2 md:p-3 rounded-xl md:rounded-2xl transition-all border border-slate-100 group shrink-0"
              title="Sign Out"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-10">
        {children}
      </main>

      <footer className="py-8 md:py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center space-y-4">
          <div className="h-px w-16 md:w-24 bg-slate-200"></div>
          <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest text-center">
            &copy; {new Date().getFullYear()} AquaSchedule &bull; Premium Dormitory Solution
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;