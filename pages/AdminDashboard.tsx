import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc, arrayUnion, arrayRemove, query, orderBy, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from '@firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@firebase/auth';
import { UserProfile, Room, PurchaseHistory, UserRole, AppSettings } from '../types';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useApp } from '../App';

// Config temporarily for creating users without logging out current admin
const firebaseConfig = {
  apiKey: "AIzaSyBg4orJChJ8Kz4SKPFcY9aizvCub_ZgZJo",
  authDomain: "splitbillgalonschedule.firebaseapp.com",
  projectId: "splitbillgalonschedule",
  storageBucket: "splitbillgalonschedule.firebasestorage.app",
  messagingSenderId: "790325290130",
  appId: "1:790325290130:web:d79d0f39bdff31bec8b24b",
};

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const { settings } = useApp();
  const [activeTab, setActiveTab] = useState<'users' | 'rooms' | 'settings'>('users');
  const [viewType, setViewType] = useState<'cards' | 'table'>('cards');
  const [roomModalTab, setRoomModalTab] = useState<'members' | 'history'>('members');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalMode, setModalMode] = useState<'edit' | 'delete' | 'create-room' | 'room-detail' | 'user-detail' | 'create-user' | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  const [previewPhotos, setPreviewPhotos] = useState<string[] | null>(null);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);

  // Swipe refs
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const [userFormData, setUserFormData] = useState({
    displayName: '', 
    email: '', 
    password: '', 
    phoneNumber: '', 
    bypassQuota: 3, 
    maxBypassQuota: 3, 
    skipCredits: 0,
    bypassDebt: 0,
    turnOrder: 0, 
    role: 'student' as UserRole, 
    roomId: '' as string | null
  });
  const [roomFormData, setRoomFormData] = useState({ name: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const inputClass = "w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block";

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
      setLoading(false);
    });
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Room)));
    });
    const unsubPurchases = onSnapshot(query(collection(db, 'purchases'), orderBy('timestamp', 'desc')), (snapshot) => {
      setPurchases(snapshot.docs.map(d => {
        const data = d.data();
        let photoUrls = data.photoUrls || (data.photoUrl ? [data.photoUrl] : []);
        return { ...data, id: d.id, photoUrls } as PurchaseHistory;
      }));
    });
    return () => { unsubUsers(); unsubRooms(); unsubPurchases(); };
  }, []);

  const compressLogo = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; 
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
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png', 0.8));
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const base64 = await compressLogo(file);
      await setDoc(doc(db, 'settings', 'global'), { logoUrl: base64 }, { merge: true });
      showToast('Logo aplikasi berhasil diperbarui!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    if (!confirm('Reset logo ke default?')) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), { logoUrl: null });
      showToast('Logo dikembalikan ke default');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current || !previewPhotos) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) setActivePreviewIdx(prev => (prev + 1) % previewPhotos.length);
    if (distance < -50) setActivePreviewIdx(prev => (prev - 1 + previewPhotos.length) % previewPhotos.length);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const tempApp = initializeApp(firebaseConfig, "temp");
    try {
      const tempAuth = getAuth(tempApp);
      const { user: newUser } = await createUserWithEmailAndPassword(tempAuth, userFormData.email.trim(), userFormData.password);
      
      const profileData: UserProfile = {
        uid: newUser.uid,
        email: userFormData.email.trim(),
        displayName: userFormData.displayName,
        role: userFormData.role,
        phoneNumber: userFormData.phoneNumber,
        bypassQuota: userFormData.bypassQuota,
        maxBypassQuota: userFormData.maxBypassQuota,
        skipCredits: userFormData.skipCredits,
        bypassDebt: userFormData.bypassDebt,
        turnOrder: userFormData.turnOrder,
        roomId: userFormData.roomId === "" ? null : userFormData.roomId,
        lastQuotaReset: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
      };

      await setDoc(doc(db, 'users', newUser.uid), profileData);
      
      if (profileData.roomId) {
        await updateDoc(doc(db, 'rooms', profileData.roomId), {
          memberUids: arrayUnion(newUser.uid)
        });
      }

      showToast(`Akun ${profileData.displayName} Berhasil Dibuat`);
      setModalMode(null);
      setUserFormData({
        displayName: '', email: '', password: '', phoneNumber: '', bypassQuota: 3, maxBypassQuota: 3, skipCredits: 0, bypassDebt: 0, turnOrder: 0, role: 'student', roomId: ''
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      await deleteApp(tempApp);
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const oldRoomId = selectedUser.roomId;
      const newRoomId = userFormData.roomId === "" ? null : userFormData.roomId;
      
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        displayName: userFormData.displayName, 
        phoneNumber: userFormData.phoneNumber, 
        bypassQuota: userFormData.bypassQuota, 
        maxBypassQuota: userFormData.maxBypassQuota, 
        skipCredits: userFormData.skipCredits,
        bypassDebt: userFormData.bypassDebt,
        turnOrder: userFormData.turnOrder, 
        role: userFormData.role, 
        roomId: newRoomId
      });

      if (oldRoomId !== newRoomId) {
        if (oldRoomId) await updateDoc(doc(db, 'rooms', oldRoomId), { memberUids: arrayRemove(selectedUser.uid) });
        if (newRoomId) await updateDoc(doc(db, 'rooms', newRoomId), { memberUids: arrayUnion(selectedUser.uid) });
      }

      setModalMode(null);
      showToast('Profil pengguna diperbarui');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setActionLoading(false); }
  };

  const handleSendResetEmail = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, selectedUser.email);
      showToast(`Email reset password dikirim ke ${selectedUser.email}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      if (selectedUser.roomId) {
        await updateDoc(doc(db, 'rooms', selectedUser.roomId), { memberUids: arrayRemove(selectedUser.uid) });
      }
      await deleteDoc(doc(db, 'users', selectedUser.uid));
      setModalMode(null);
      showToast('Pengguna dihapus');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setActionLoading(false); }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'rooms'), { name: roomFormData.name, currentTurnIndex: 0, memberUids: [], cycleCount: 0 });
      setModalMode(null);
      setRoomFormData({ name: '' });
      showToast('Kamar berhasil dibuat');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setActionLoading(false); }
  };

  const openUserAction = (user: UserProfile, mode: 'edit' | 'delete' | 'user-detail') => {
    setSelectedUser(user);
    setModalMode(mode);
    if (mode === 'edit') {
      setUserFormData({
        displayName: user.displayName, 
        email: user.email, 
        password: '', 
        phoneNumber: user.phoneNumber || '', 
        bypassQuota: user.bypassQuota || 0, 
        maxBypassQuota: user.maxBypassQuota || 3, 
        skipCredits: user.skipCredits || 0,
        bypassDebt: user.bypassDebt || 0,
        turnOrder: user.turnOrder || 0, 
        role: user.role, 
        roomId: user.roomId || ''
      });
    }
  };

  const openRoomAction = (room: Room, mode: 'room-detail') => { 
    setSelectedRoom(room); 
    setRoomModalTab('members'); 
    setModalMode(mode); 
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (ts: any) => {
    if (!ts) return 'Baru saja';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Menghubungkan ke Pusat Kontrol...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-20 px-4 max-w-7xl mx-auto">
      {/* Header Admin */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Administrator Panel</p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Control Center</h1>
          </div>
          <div className="flex bg-white/10 p-1.5 rounded-[1.5rem] backdrop-blur-xl border border-white/10 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('users')} 
              className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'}`}
            >
              Pengguna
            </button>
            <button 
              onClick={() => setActiveTab('rooms')} 
              className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'}`}
            >
              Kamar
            </button>
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'}`}
            >
              Pengaturan
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-6 animate-slide-up">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:max-w-2xl">
                <div className="relative flex-1 w-full">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                    type="text" 
                    placeholder="Cari Nama atau Email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-sm text-slate-900"
                  />
                </div>
                <button 
                  onClick={() => setModalMode('create-user')}
                  className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  Tambah Pengguna
                </button>
             </div>
             
             <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                <button 
                  onClick={() => setViewType('cards')} 
                  className={`p-2.5 px-4 rounded-xl transition-all duration-300 flex items-center gap-2 ${viewType === 'cards' ? 'bg-white text-slate-900 shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5h6v6H4V5zM14 5h6v6h-6V5zM4 15h6v6H4v-6zm10 0h6v6h-6v-6z" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Grid</span>
                </button>
                <button 
                  onClick={() => setViewType('table')} 
                  className={`p-2.5 px-4 rounded-xl transition-all duration-300 flex items-center gap-2 ${viewType === 'table' ? 'bg-white text-slate-900 shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">List</span>
                </button>
             </div>
          </div>

          {viewType === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.uid} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group animate-in fade-in duration-300">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border-2 border-slate-50">
                      {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xl font-black text-slate-300">{u.displayName.charAt(0)}</div>}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 truncate leading-tight">{u.displayName}</h4>
                      <p className="text-xs text-slate-400 font-medium truncate">{u.email}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-red-100 text-red-600' : u.role === 'tukang_galon' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                     <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Kamar</p>
                        <p className="text-[10px] font-black text-slate-900 truncate">{rooms.find(r => r.id === u.roomId)?.name || 'N/A'}</p>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Bypass</p>
                        <p className="text-[10px] font-black text-slate-900">{u.bypassQuota} / {u.maxBypassQuota}</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => openUserAction(u, 'user-detail')} className="flex-1 py-3 bg-slate-100 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Detail</button>
                     <button onClick={() => openUserAction(u, 'edit')} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Edit</button>
                     <button onClick={() => openUserAction(u, 'delete')} className="px-4 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                     <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                           <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Foto</th>
                           <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama / Email</th>
                           <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                           <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Kamar</th>
                           <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-slate-900">
                        {filteredUsers.map(u => (
                           <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="h-10 w-10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                                    {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs font-black text-slate-300">{u.displayName.charAt(0)}</div>}
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <p className="font-black text-xs">{u.displayName}</p>
                                 <p className="text-[10px] text-slate-400">{u.email}</p>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`inline-block px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-red-100 text-red-600' : u.role === 'tukang_galon' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span>
                              </td>
                              <td className="px-6 py-4">
                                 <p className="text-[10px] font-black">{rooms.find(r => r.id === u.roomId)?.name || '-'}</p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex justify-end gap-2">
                                    <button onClick={() => openUserAction(u, 'user-detail')} className="p-2 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="Detail"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                                    <button onClick={() => openUserAction(u, 'edit')} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-lg transition-all" title="Edit"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => openUserAction(u, 'delete')} className="p-2 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="Hapus"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>
      ) : activeTab === 'rooms' ? (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center px-2">
             <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Kamar</h2>
             <button onClick={() => setModalMode('create-room')} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Tambah Kamar
             </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map(r => (
              <div key={r.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group animate-in fade-in duration-300">
                <div className="flex justify-between items-start mb-6">
                   <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m4 0h1m-5 4h1m4 0h1m-5 4h1m4 0h1m-5 4h1m4 0h1m-5 4h1m4 0h1m-5 4h1m4 0h1m-5 4h1" /></svg>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cycle</p>
                      <p className="text-xl font-black text-slate-900">{r.cycleCount || 0}</p>
                   </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">{r.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">{r.memberUids.length} Penghuni Terdaftar</p>
                <button onClick={() => openRoomAction(r, 'room-detail')} className="w-full py-4 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Lihat Detail Kamar</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
           <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-10">
              <div className="flex-1 space-y-8">
                 <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Kustomisasi Branding</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atur Logo yang akan tampil di halaman Login, Register, dan Header.</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="relative group max-w-xs">
                       <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex items-center justify-center overflow-hidden transition-all group-hover:bg-blue-50/50 group-hover:border-blue-200">
                          {settings?.logoUrl ? (
                            <img src={settings.logoUrl} className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" alt="App Logo" />
                          ) : (
                            <div className="text-center p-8">
                               <div className="bg-slate-100 p-4 rounded-2xl inline-block mb-3 text-slate-300">
                                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                               </div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Belum ada logo kustom</p>
                            </div>
                          )}
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/png,image/jpeg" onChange={handleLogoUpload} disabled={uploadingLogo} />
                          {uploadingLogo && (
                             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                             </div>
                          )}
                       </div>
                       <div className="mt-4 flex gap-3">
                          <button 
                            onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200"
                          >
                            Upload Logo
                          </button>
                          {settings?.logoUrl && (
                             <button 
                               onClick={handleResetLogo}
                               className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100"
                             >
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                          )}
                       </div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-300 italic">*Direkomendasikan file PNG transparant ukuran 512x512</p>
                 </div>
              </div>

              <div className="hidden lg:block w-px bg-slate-100"></div>

              <div className="flex-1 space-y-6">
                 <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Preview Branding</h4>
                    <div className="space-y-6">
                       <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center p-2">
                             {settings?.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain" /> : <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                          </div>
                          <p className="font-black text-slate-900 text-sm">Header App</p>
                       </div>
                       <div className="bg-white p-10 rounded-2xl shadow-sm text-center">
                          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] mx-auto mb-4 flex items-center justify-center p-4">
                             {settings?.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain" /> : <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                          </div>
                          <p className="font-black text-slate-900 text-sm mb-1">GalonAsrama</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Halaman Auth</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      <Modal isOpen={modalMode === 'room-detail'} onClose={() => setModalMode(null)} title={`Detail Kamar: ${selectedRoom?.name}`} maxWidth="max-w-4xl">
        {selectedRoom && (
          <div className="space-y-10 animate-slide-up">
            {/* Massive Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-200/50">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Pengeluaran</p>
                  <h4 className="text-3xl font-black">Rp {purchases.filter(p => p.roomId === selectedRoom.id).reduce((acc, curr) => acc + curr.cost, 0).toLocaleString()}</h4>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Volume Galon</p>
                  <h4 className="text-3xl font-black text-slate-900">{purchases.filter(p => p.roomId === selectedRoom.id).length} <span className="text-[10px] text-slate-300 font-bold uppercase">Unit Terdaftar</span></h4>
               </div>
               <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-2">Cycle Sekarang</p>
                  <h4 className="text-3xl font-black">Cycle #{selectedRoom.cycleCount || 0}</h4>
               </div>
            </div>

            {/* Current Turn Focus */}
            {selectedRoom.memberUids.length > 0 && (
               <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                     <div className="h-20 w-20 bg-blue-600 rounded-[1.8rem] flex items-center justify-center text-white border-4 border-white shadow-lg overflow-hidden shrink-0">
                        {users.filter(u => u.roomId === selectedRoom.id).sort((a,b) => a.turnOrder - b.turnOrder)[selectedRoom.currentTurnIndex]?.photoUrl ? (
                           <img src={users.filter(u => u.roomId === selectedRoom.id).sort((a,b) => a.turnOrder - b.turnOrder)[selectedRoom.currentTurnIndex].photoUrl} className="w-full h-full object-cover" />
                        ) : (
                           <span className="text-2xl font-black">{users.filter(u => u.roomId === selectedRoom.id).sort((a,b) => a.turnOrder - b.turnOrder)[selectedRoom.currentTurnIndex]?.displayName.charAt(0)}</span>
                        )}
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Penanggung Jawab Aktif</p>
                        <h5 className="text-2xl font-black text-slate-900">{users.filter(u => u.roomId === selectedRoom.id).sort((a,b) => a.turnOrder - b.turnOrder)[selectedRoom.currentTurnIndex]?.displayName || 'Menunggu'}</h5>
                     </div>
                  </div>
                  <span className="hidden sm:block px-6 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-100 animate-pulse">Sedang Giliran</span>
               </div>
            )}

            {/* Tabs Control */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              {['members', 'history'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setRoomModalTab(tab as any)} 
                  className={`flex-1 py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all ${roomModalTab === tab ? 'bg-white shadow-xl text-slate-900 scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab === 'members' ? 'Analisis Penghuni' : 'Arsip Transaksi'}
                </button>
              ))}
            </div>

            {roomModalTab === 'members' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
                 {users.filter(u => u.roomId === selectedRoom.id).sort((a,b) => a.turnOrder - b.turnOrder).map((m, idx) => {
                   const userPurchases = purchases.filter(p => p.buyerUid === m.uid && p.roomId === selectedRoom.id);
                   return (
                      <div key={m.uid} className="flex flex-col p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all group">
                         <div className="flex items-center gap-4 mb-4">
                            <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden shrink-0 group-hover:scale-110 transition-transform">
                               {m.photoUrl ? (
                                 <img src={m.photoUrl} className="w-full h-full object-cover" />
                               ) : (
                                 <span className="font-black text-sm text-slate-300">{m.displayName.charAt(0)}</span>
                               )}
                            </div>
                            <div className="min-w-0">
                               <p className="text-sm font-black text-slate-900 leading-tight truncate">{m.displayName}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Order #{m.turnOrder}</p>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-3 rounded-xl">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Beli</p>
                               <p className="text-sm font-black text-slate-900">{userPurchases.length} Galon</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Bypass Quota</p>
                               <p className="text-sm font-black text-slate-900">{m.bypassQuota} / {m.maxBypassQuota}</p>
                            </div>
                         </div>
                      </div>
                   )
                 })}
                 {users.filter(u => u.roomId === selectedRoom.id).length === 0 && <p className="col-span-full text-center py-20 text-[11px] font-black text-slate-300 uppercase italic">Kamar Kosong - Tidak ada penghuni terdaftar</p>}
              </div>
            ) : (
              <div className="space-y-4 animate-slide-up">
                {purchases.filter(p => p.roomId === selectedRoom.id).length === 0 ? (
                  <div className="py-20 text-center text-[11px] font-black text-slate-300 uppercase italic">Belum ada transaksi terekam untuk kamar ini</div>
                ) : (
                  purchases.filter(p => p.roomId === selectedRoom.id).map(p => (
                    <div key={p.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-6">
                        <div 
                          onClick={() => { if (p.photoUrls?.length > 0) { setPreviewPhotos(p.photoUrls); setActivePreviewIdx(0); } }} 
                          className="h-20 w-20 rounded-2xl bg-slate-100 overflow-hidden cursor-pointer relative shrink-0 border border-slate-100 group-hover:scale-105 transition-transform"
                        >
                          {p.photoUrls?.[0] && <img src={p.photoUrls[0]} className="w-full h-full object-cover" />}
                          {p.photoUrls && p.photoUrls.length > 1 && <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] font-black px-1.5 rounded-md backdrop-blur-sm">+{p.photoUrls.length - 1}</span>}
                        </div>
                        <div className="min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-md text-slate-900 truncate">{p.buyerName}</p>
                              {p.isDebtPayment && <span className="bg-red-50 text-red-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-red-100">Pelunasan</span>}
                              {p.isBypassTask && <span className="bg-amber-50 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-amber-100">Bypass</span>}
                           </div>
                           <p className="text-[11px] text-slate-400 font-bold">{formatDate(p.timestamp)}</p>
                           <p className="text-lg font-black text-blue-600 mt-2 tracking-tight">Rp {p.cost.toLocaleString()}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setPreviewPhotos(p.photoUrls); setActivePreviewIdx(0); }}
                        className="p-4 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-2xl transition-all"
                      >
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <button onClick={() => setModalMode(null)} className="w-full py-6 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-xl hover:bg-black active:scale-[0.98]">Tutup Detail Kamar</button>
          </div>
        )}
      </Modal>

      {/* MODALS - Lainnya tetap sama */}
      <Modal isOpen={modalMode === 'create-user'} onClose={() => setModalMode(null)} title="Registrasi Pengguna Baru" maxWidth="max-w-2xl">
         <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="space-y-4 text-slate-900">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className={labelClass}>Nama Lengkap</label>
                     <input type="text" required value={userFormData.displayName} onChange={e => setUserFormData({...userFormData, displayName: e.target.value})} className={inputClass} placeholder="Contoh: John Doe" />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp</label>
                    <input type="tel" required value={userFormData.phoneNumber} onChange={e => setUserFormData({...userFormData, phoneNumber: e.target.value})} className={inputClass} placeholder="08123456789" />
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" required value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className={inputClass} placeholder="email@aqua.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input type="password" required value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} className={inputClass} placeholder="••••••••" />
                  </div>
               </div>

               <div>
                  <label className={labelClass}>Role Aktor</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as UserRole})} className={inputClass}>
                    <option value="student">Siswa (Penghuni)</option>
                    <option value="tukang_galon">Tukang Galon (Kurir)</option>
                    <option value="admin">Administrator</option>
                  </select>
               </div>

               {userFormData.role === 'student' && (
                 <>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className={labelClass}>Penugasan Kamar</label>
                         <select value={userFormData.roomId || ""} onChange={e => setUserFormData({...userFormData, roomId: e.target.value})} className={inputClass}>
                           <option value="">Belum Ada Kamar</option>
                           {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className={labelClass}>Urutan Antrean (#)</label>
                         <input type="number" value={userFormData.turnOrder} onChange={e => setUserFormData({...userFormData, turnOrder: Number(e.target.value)})} className={inputClass} />
                      </div>
                   </div>

                   <div className="pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Konfigurasi Bypass & Hutang</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div>
                            <label className={labelClass}>Quota Now</label>
                            <input type="number" value={userFormData.bypassQuota} onChange={e => setUserFormData({...userFormData, bypassQuota: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Max Quota</label>
                            <input type="number" value={userFormData.bypassQuota} onChange={e => setUserFormData({...userFormData, maxBypassQuota: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Skip Point</label>
                            <input type="number" value={userFormData.skipCredits} onChange={e => setUserFormData({...userFormData, skipCredits: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Debt (Utang)</label>
                            <input type="number" value={userFormData.bypassDebt} onChange={e => setUserFormData({...userFormData, bypassDebt: Number(e.target.value)})} className={inputClass} />
                         </div>
                      </div>
                   </div>
                 </>
               )}
            </div>
            <button type="submit" disabled={actionLoading} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">DAFTARKAN SEKARANG</button>
         </form>
      </Modal>

      <Modal isOpen={modalMode === 'edit'} onClose={() => setModalMode(null)} title="Edit Profil Pengguna" maxWidth="max-w-2xl">
        {selectedUser && (
          <form onSubmit={handleUpdateUser} className="space-y-6 text-slate-900">
            <div className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className={labelClass}>Nama Lengkap</label>
                     <input type="text" value={userFormData.displayName} onChange={e => setUserFormData({...userFormData, displayName: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                     <label className={labelClass}>WhatsApp</label>
                     <input type="tel" value={userFormData.phoneNumber} onChange={e => setUserFormData({...userFormData, phoneNumber: e.target.value})} className={inputClass} />
                  </div>
               </div>

               <div>
                  <label className={labelClass}>Role</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as UserRole})} className={inputClass}>
                    <option value="student">Siswa</option>
                    <option value="tukang_galon">Tukang</option>
                    <option value="admin">Admin</option>
                  </select>
               </div>

               {userFormData.role === 'student' && (
                 <>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Kamar</label>
                        <select value={userFormData.roomId || ""} onChange={e => setUserFormData({...userFormData, roomId: e.target.value})} className={inputClass}>
                          <option value="">N/A</option>
                          {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Antrean #</label>
                        <input type="number" value={userFormData.turnOrder} onChange={e => setUserFormData({...userFormData, turnOrder: Number(e.target.value)})} className={inputClass} />
                      </div>
                   </div>

                   <div className="pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Konfigurasi Bypass & Hutang</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div>
                            <label className={labelClass}>Quota Now</label>
                            <input type="number" value={userFormData.bypassQuota} onChange={e => setUserFormData({...userFormData, bypassQuota: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Max Quota</label>
                            <input type="number" value={userFormData.bypassQuota} onChange={e => setUserFormData({...userFormData, maxBypassQuota: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Skip Point</label>
                            <input type="number" value={userFormData.skipCredits} onChange={e => setUserFormData({...userFormData, skipCredits: Number(e.target.value)})} className={inputClass} />
                         </div>
                         <div>
                            <label className={labelClass}>Debt (Utang)</label>
                            <input type="number" value={userFormData.bypassDebt} onChange={e => setUserFormData({...userFormData, bypassDebt: Number(e.target.value)})} className={inputClass} />
                         </div>
                      </div>
                   </div>
                 </>
               )}
            </div>
            <button type="submit" disabled={actionLoading} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">SIMPAN PERUBAHAN</button>
          </form>
        )}
      </Modal>

      <Modal isOpen={modalMode === 'user-detail'} onClose={() => setModalMode(null)} title="Informasi Lengkap Pengguna" maxWidth="max-w-2xl">
        {selectedUser && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-28 w-28 rounded-[2.5rem] bg-slate-100 p-1 shadow-lg border-2 border-white">
                 {selectedUser.photoUrl ? (
                   <img src={selectedUser.photoUrl} className="w-full h-full object-cover rounded-[2.2rem]" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-300">{selectedUser.displayName.charAt(0)}</div>
                 )}
              </div>
              <div>
                 <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedUser.displayName}</h4>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedUser.email}</p>
                 <div className="flex justify-center mt-3 gap-2">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-100">{selectedUser.role}</span>
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-slate-100">{rooms.find(r => r.id === selectedUser.roomId)?.name || 'Kamar N/A'}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Quota</p>
                 <p className="text-lg font-black text-slate-900">{selectedUser.bypassQuota} / {selectedUser.maxBypassQuota}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 text-center">
                 <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-1">Point Skip</p>
                 <p className="text-lg font-black text-emerald-600">{selectedUser.skipCredits}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-3xl border border-red-100 text-center">
                 <p className="text-[7px] font-black text-red-600 uppercase tracking-widest mb-1">Utang</p>
                 <p className="text-lg font-black text-red-600">{selectedUser.bypassDebt}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 text-center">
                 <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Unit</p>
                 <p className="text-lg font-black text-amber-600">{purchases.filter(p => p.buyerUid === selectedUser.uid).length}</p>
              </div>
            </div>

            <button onClick={() => setModalMode(null)} className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-xl hover:bg-black">Tutup Detail</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === 'delete'} onClose={() => setModalMode(null)} title="Hapus Pengguna">
         <div className="text-center space-y-6">
            <p className="text-sm font-bold text-slate-500 leading-relaxed">Hapus akun <span className="text-slate-900 font-black">{selectedUser?.displayName}</span>? Penghuni ini akan dilepas dari antrean kamar.</p>
            <div className="flex flex-col gap-3">
               <button onClick={handleDeleteUser} disabled={actionLoading} className="w-full py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200">YA, HAPUS PERMANEN</button>
               <button onClick={() => setModalMode(null)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest">BATALKAN</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={modalMode === 'create-room'} onClose={() => setModalMode(null)} title="Buat Kamar Baru">
         <form onSubmit={handleCreateRoom} className="space-y-6 text-slate-900">
            <div>
               <label className={labelClass}>Nama Identitas Kamar</label>
               <input type="text" value={roomFormData.name} onChange={e => setRoomFormData({name: e.target.value})} className={inputClass} placeholder="Contoh: Kamar A-1" required />
            </div>
            <button type="submit" disabled={actionLoading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all">BUAT KAMAR BARU</button>
         </form>
      </Modal>

      <Modal isOpen={previewPhotos !== null} onClose={() => { setPreviewPhotos(null); setActivePreviewIdx(0); }} title="Bukti Transaksi" maxWidth="max-w-4xl">
        {previewPhotos && (
          <div className="space-y-8">
            <div 
              className="relative w-full overflow-hidden rounded-[2.5rem] group cursor-grab active:cursor-grabbing"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div 
                className="flex transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)"
                style={{ transform: `translateX(-${activePreviewIdx * 100}%)` }}
              >
                {previewPhotos.map((img, idx) => (
                  <div key={idx} className="min-w-full flex justify-center items-center bg-slate-50/50 p-4">
                    <img src={img} className="max-w-full max-h-[60vh] object-contain shadow-2xl border-4 border-white rounded-[2rem] select-none pointer-events-none" alt={`Bukti ${idx + 1}`} />
                  </div>
                ))}
              </div>
              
              {previewPhotos.length > 1 && (
                <>
                  <button onClick={() => setActivePreviewIdx((activePreviewIdx - 1 + previewPhotos.length) % previewPhotos.length)} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-slate-900 hover:text-white hidden md:block">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setActivePreviewIdx((activePreviewIdx + 1) % previewPhotos.length)} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-slate-900 hover:text-white hidden md:block">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-6">
               {previewPhotos.length > 1 && (
                 <div className="flex gap-2 justify-center">
                   {previewPhotos.map((_, i) => (
                     <button key={i} onClick={() => setActivePreviewIdx(i)} className={`h-2 rounded-full transition-all duration-500 ${i === activePreviewIdx ? 'bg-slate-900 w-10' : 'bg-slate-200 w-2'}`}></button>
                   ))}
                 </div>
               )}
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{activePreviewIdx + 1} dari {previewPhotos.length} Dokumen</p>
                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-4 italic">Geser gambar untuk navigasi</p>
               </div>
               <button onClick={() => { setPreviewPhotos(null); setActivePreviewIdx(0); }} className="w-full bg-slate-900 text-white py-5 rounded-[1.8rem] font-black text-xs uppercase shadow-lg hover:bg-black transition-all tracking-widest active:scale-95">TUTUP ARSIP</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;