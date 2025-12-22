import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from '@firebase/auth';
import { auth } from '../firebase';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useApp } from '../App';

const Login: React.FC = () => {
  const { showToast } = useToast();
  const { settings } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (err: any) {
      console.error("Login error code:", err.code);
      if (err.code === 'auth/invalid-credential') {
        setError('Email atau password salah. Silakan periksa kembali.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Akun tidak ditemukan.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Kata sandi salah.');
      } else {
        setError('Gagal masuk. Silakan coba lagi nanti.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      showToast('Masukkan email terlebih dahulu', 'error');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      showToast('Link reset password telah dikirim ke email Anda!', 'success');
      setIsResetModalOpen(false);
      setResetEmail('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] py-12 px-6 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-80 h-80 bg-blue-100 rounded-full blur-[120px] opacity-60"></div>
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>

      <div className="max-w-md w-full space-y-10 glass p-10 sm:p-12 rounded-[3.5rem] shadow-2xl shadow-blue-900/5 border border-white animate-slide-up relative z-10">
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center justify-center mx-auto h-24 w-24 overflow-hidden transition-all ${!settings?.logoUrl ? 'p-5 bg-slate-900 rounded-[2rem] shadow-2xl shadow-slate-300' : ''}`}>
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">AquaSchedule</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal Login Asrama</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 text-center animate-shake">
              {error}
            </div>
          )}
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Secure Password</label>
                <button 
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors"
                >
                  Lupa Password?
                </button>
              </div>
              <input
                type="password"
                required
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl disabled:opacity-50 active:scale-95 flex items-center justify-center space-x-3"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <span>SIGN IN SEKARANG</span>}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Belum punya akun?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 transition-colors font-black">
              Daftar Disini
            </Link>
          </p>
        </div>
      </div>

      {/* Modal Lupa Password */}
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Reset Kata Sandi">
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
            <p className="text-xs font-bold text-blue-900 leading-relaxed text-center">
              Masukkan email Anda dan kami akan mengirimkan link untuk mengatur ulang kata sandi Anda.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Email</label>
            <input 
              type="email" 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
              placeholder="nama@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <button 
              type="submit" 
              disabled={resetLoading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center"
            >
              {resetLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'KIRIM LINK RESET'}
            </button>
            <button 
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="w-full py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
            >
              Batal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Login;