import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from '@firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { useApp } from '../App';

const Register: React.FC = () => {
  const { settings } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Password konfirmasi tidak cocok');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal harus 6 karakter');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      const newUser: UserProfile = {
        uid: user.uid,
        email: email.trim(),
        displayName: name,
        role: 'student',
        roomId: null,
        turnOrder: 0,
        phoneNumber: phoneNumber.trim(),
        bypassQuota: 3,
        maxBypassQuota: 3,
        skipCredits: 0,
        bypassDebt: 0,
        lastQuotaReset: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
      };

      await setDoc(doc(db, 'users', user.uid), newUser);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar di sistem.');
      } else {
        setError('Gagal mendaftar. Silakan coba lagi nanti.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-6 relative overflow-hidden bg-slate-50">
      {/* White Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50" />

      <div className="max-w-md w-full space-y-6 bg-white/70 backdrop-blur-xl p-8 sm:p-10 rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-white/80 animate-slide-up relative z-10">
        <div className="text-center space-y-3">
          <div className={`inline-flex items-center justify-center mx-auto h-16 w-16 overflow-hidden transition-all animate-breathe ${!settings?.logoUrl ? 'p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-[1.2rem] shadow-2xl shadow-purple-500/30' : ''}`}>
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">GalonAsrama</h2>
            <p className="text-blue-600/60 font-bold uppercase tracking-widest text-[10px]">Pendaftaran Siswa Baru</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-100 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-200 text-center animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Nama Lengkap</label>
              <input
                type="text"
                required
                className="w-full px-6 py-3 bg-white/60 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder-slate-400 input-focus-glow"
                placeholder="Contoh: John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-6 py-3 bg-white/60 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder-slate-400 input-focus-glow"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Nomor WhatsApp</label>
              <input
                type="tel"
                required
                className="w-full px-6 py-3 bg-white/60 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder-slate-400 input-focus-glow"
                placeholder="Contoh: 08123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-6 py-3 bg-white/60 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder-slate-400 input-focus-glow"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Konfirmasi</label>
                <input
                  type="password"
                  required
                  className="w-full px-6 py-3 bg-white/60 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all font-bold text-slate-900 placeholder-slate-400 input-focus-glow"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-blue-500/25 disabled:opacity-50 active:scale-95 flex items-center justify-center space-x-3 btn-hover-lift ripple hover-jelly"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span>DAFTAR SEKARANG</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Sudah memiliki akun?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-500 transition-colors font-black">
              Masuk Disini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;