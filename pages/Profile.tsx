import React, { useState, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
// Use modular sub-package to resolve "no exported member" errors
import { updateProfile, updatePassword } from '@firebase/auth';
import { UserProfile } from '../types';
import { useToast } from '../context/ToastContext';

interface ProfileProps {
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdate }) => {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputStyle = "w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium";

  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 300; 
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject("Canvas error");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.5)); 
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const base64 = await compressAndGetBase64(file);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoUrl: base64 });
      onUpdate({ ...user, photoUrl: base64 });
      showToast('Foto profil berhasil diperbarui!');
    } catch (error: any) {
      showToast('Gagal memperbarui foto: ' + error.message, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {};
      
      if (displayName !== user.displayName) {
        updates.displayName = displayName;
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName });
        }
      }

      if (phoneNumber !== user.phoneNumber) {
        updates.phoneNumber = phoneNumber;
      }

      if (Object.keys(updates).length > 0) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, updates);
      }

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error("Konfirmasi password tidak cocok");
        }
        if (newPassword.length < 6) {
          throw new Error("Password minimal 6 karakter");
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        }
      }

      onUpdate({ ...user, displayName, phoneNumber });
      setNewPassword('');
      setConfirmPassword('');
      showToast('Akun berhasil diperbarui!');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 py-10 px-4">
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-100/50 border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 h-32 relative">
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
            <div className="relative group">
              <div className="h-32 w-32 rounded-[2.5rem] bg-white p-1.5 shadow-2xl">
                <div className="h-full w-full rounded-[2.2rem] bg-blue-50 overflow-hidden flex items-center justify-center border-2 border-gray-100 relative">
                  {uploadingPhoto ? (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-blue-200 uppercase">{user.displayName?.charAt(0) || '?'}</span>
                  )}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg hover:bg-blue-700 transition-all border-4 border-white group-hover:scale-110 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          </div>
        </div>

        <div className="pt-20 pb-10 px-8 sm:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{user.displayName}</h2>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">{user.role} &bull; <span className="lowercase">{user.email}</span></p>
          </div>

          <form onSubmit={handleUpdateAccount} className="space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nama Tampilan</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputStyle}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nomor WhatsApp</label>
                <input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={inputStyle}
                  placeholder="Contoh: 08123456789"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-50">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 ml-1">Ganti Kata Sandi (Opsional)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password Baru</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputStyle}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Konfirmasi</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputStyle}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                type="submit" 
                disabled={loading || uploadingPhoto}
                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl disabled:opacity-50 active:scale-95"
              >
                {loading ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
              </button>
              <button 
                type="button"
                onClick={() => window.history.back()}
                className="w-full bg-white border border-slate-100 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                KEMBALI KE DASHBOARD
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; export default Profile;