import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, where, orderBy, increment } from 'firebase/firestore';
import { UserProfile, Room, PurchaseHistory, DeliveryOrder, StudentStatus } from '../types';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { sendWA } from '../utils/whatsapp';
import { useApp } from '../App';

interface StudentDashboardProps {
  user: UserProfile;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const { showToast } = useToast();
  const { settings } = useApp();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [purchaseCost, setPurchaseCost] = useState<number>(6000);
  const [description, setDescription] = useState<string>('');

  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [activeViewIdx, setActiveViewIdx] = useState(0);

  const [isBypassModalOpen, setIsBypassModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [insightTab, setInsightTab] = useState<'helping' | 'borrowing'>('helping');

  const [isDeliveryEnabled, setIsDeliveryEnabled] = useState(false);
  const [selectedTukang, setSelectedTukang] = useState<UserProfile | null>(null);

  const [bypassing, setBypassing] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [availableTukang, setAvailableTukang] = useState<UserProfile[]>([]);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const formatDate = (ts: any, full = false) => {
    if (!ts) return 'Baru saja';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: full ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCurrentMonth = (ts: any) => {
    if (!ts) return true;
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  useEffect(() => {
    if (!user.roomId) {
      setLoading(false);
      return;
    }

    const unsubRoom = onSnapshot(doc(db, 'rooms', user.roomId), (snapshot) => {
      if (!snapshot.exists()) return;
      setRoom({ ...snapshot.data(), id: snapshot.id } as Room);
    });

    const qMembers = query(collection(db, 'users'), where('roomId', '==', user.roomId));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      const membersData = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      const sortedMembers = membersData.sort((a, b) => (a.turnOrder || 0) - (b.turnOrder || 0));
      setMembers(sortedMembers);
      setLoading(false);
    });

    const qHistory = query(
      collection(db, 'purchases'),
      where('roomId', '==', user.roomId),
      orderBy('timestamp', 'desc')
    );
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(d => {
        const data = d.data();
        let photoUrls = data.photoUrls;
        if (!Array.isArray(photoUrls)) {
          photoUrls = data.photoUrl ? [data.photoUrl] : [];
        }
        return { ...data, id: d.id, photoUrls } as PurchaseHistory;
      }));
    });

    const qDeliveries = query(
      collection(db, 'delivery_orders'),
      where('roomId', '==', user.roomId),
      where('status', 'in', ['pending', 'processing'])
    );
    const unsubDeliveries = onSnapshot(qDeliveries, (snapshot) => {
      if (!snapshot.empty) {
        setActiveDelivery({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as DeliveryOrder);
      } else {
        setActiveDelivery(null);
      }
    });

    const qTukang = query(
      collection(db, 'users'),
      where('role', '==', 'tukang_galon'),
      where('isOnline', '==', true)
    );
    const unsubTukang = onSnapshot(qTukang, (snapshot) => {
      setAvailableTukang(snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    });

    return () => {
      unsubRoom();
      unsubMembers();
      unsubHistory();
      unsubDeliveries();
      unsubTukang();
    };
  }, [user.roomId]);

  const currentMonthHistory = useMemo(() => history.filter(h => isCurrentMonth(h.timestamp)), [history]);
  const currentMonthSpend = useMemo(() => currentMonthHistory.reduce((acc, h) => acc + (h.cost || 0), 0), [currentMonthHistory]);
  const totalRoomSpend = useMemo(() => history.reduce((acc, h) => acc + (h.cost || 0), 0), [history]);

  const stats = useMemo(() => {
    const buyerCounts: { [name: string]: number } = {};
    const helperCounts: { [name: string]: number } = {};
    const helpeeCounts: { [name: string]: number } = {};

    history.forEach(h => {
      buyerCounts[h.buyerName] = (buyerCounts[h.buyerName] || 0) + 1;
    });

    members.forEach(m => {
      if (m.helpedBy) {
        (Object.entries(m.helpedBy) as [string, any][]).forEach(([helpeeUid, data]) => {
          helpeeCounts[data.name] = (helpeeCounts[data.name] || 0) + data.count;
          helperCounts[m.displayName] = (helperCounts[m.displayName] || 0) + data.count;
        });
      }
    });

    return {
      topBuyer: Object.entries(buyerCounts).sort((a, b) => b[1] - a[1])[0],
      topHelper: Object.entries(helperCounts).sort((a, b) => b[1] - a[1])[0],
      mostHelped: Object.entries(helpeeCounts).sort((a, b) => b[1] - a[1])[0],
    };
  }, [history, members]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
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
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressImage(files[i]);
      newPhotos.push(compressed);
    }
    setSelectedPhotos(prev => [...prev, ...newPhotos]);
    setIsCompressing(false);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async () => {
    if (selectedPhotos.length === 0 || !room || members.length === 0) {
      showToast('Harap unggah bukti foto!', 'error');
      return;
    }

    if (isDeliveryEnabled && !selectedTukang) {
      showToast('Harap pilih petugas pengantar atau nonaktifkan jasa kurir!', 'error');
      return;
    }

    setUploading(true);
    try {
      const activeIdx = room.currentTurnIndex;
      const currentBuyer = members[activeIdx];
      const isPayingDebt = (currentBuyer.bypassDebt || 0) > 0;

      const purchaseData: any = {
        buyerUid: currentBuyer.uid,
        buyerName: currentBuyer.displayName,
        roomId: room.id,
        roomName: room.name,
        photoUrls: selectedPhotos,
        timestamp: serverTimestamp(),
        cost: purchaseCost,
        description: description,
        isBypassTask: !!room.lastBypasserUid,
        isDebtPayment: isPayingDebt,
        deliveryType: isDeliveryEnabled ? 'courier' : 'self'
      };

      const purchaseRef = await addDoc(collection(db, 'purchases'), purchaseData);

      if (isDeliveryEnabled && selectedTukang) {
        const isBroadcast = selectedTukang.uid === 'broadcast';
        const orderData: any = {
          roomId: room.id,
          roomName: room.name,
          buyerUid: currentBuyer.uid,
          buyerName: currentBuyer.displayName,
          status: 'pending',
          cost: purchaseCost,
          description: description,
          timestamp: serverTimestamp(),
          tukangGalonUid: isBroadcast ? null : selectedTukang.uid,
          tukangGalonName: isBroadcast ? "Siapa Saja" : selectedTukang.displayName,
          photoUrls: selectedPhotos,
          purchaseId: purchaseRef.id
        };
        await addDoc(collection(db, 'delivery_orders'), orderData);

        if (settings?.isWANotificationsEnabled) {
          const waMessage = `💧 *PESANAN GALON BARU!*\n---\n📍 *Kamar:* ${room.name}\n👤 *Pemesan:* ${currentBuyer.displayName}\n💰 *Biaya:* Rp ${purchaseCost.toLocaleString()}\n📝 *Catatan:* ${description || '-'}\n---\nMohon segera diproses melalui web AquaSchedule. Bukti pembayaran sudah diupload di sistem.`;

          if (isBroadcast) {
            availableTukang.forEach(t => {
              if (t.phoneNumber) sendWA(t.phoneNumber, waMessage);
            });
          } else {
            if (selectedTukang.phoneNumber) {
              sendWA(selectedTukang.phoneNumber, waMessage);
            }
          }
        }
      }

      let nextMemberName = "";
      let nextUserToNotify: UserProfile | undefined;

      if (isPayingDebt) {
        await updateDoc(doc(db, 'users', currentBuyer.uid), {
          bypassDebt: increment(-1)
        });
        const currentDebt = currentBuyer.bypassDebt || 0;
        if (currentDebt > 1) {
          nextMemberName = `${currentBuyer.displayName} (Sisa Utang: ${currentDebt - 1})`;
          nextUserToNotify = currentBuyer;
        } else {
          nextMemberName = members[room.currentTurnIndex].displayName;
          nextUserToNotify = members[room.currentTurnIndex];
        }
      } else {
        let nextIndex;
        let isCycleCompleted = false;

        if (room.lastBypasserUid) {
          const bypasserIdx = members.findIndex(m => m.uid === room.lastBypasserUid);
          nextIndex = (bypasserIdx + 1) % members.length;
        } else {
          nextIndex = (activeIdx + 1) % members.length;
        }

        let skipLoopCount = 0;
        while ((members[nextIndex].skipCredits > 0 || members[nextIndex].status === 'cuti') && skipLoopCount < members.length) {
          const skippedUser = members[nextIndex];
          // Only decrement skipCredits if they have any (don't decrement for cuti)
          if (skippedUser.skipCredits > 0) {
            await updateDoc(doc(db, 'users', skippedUser.uid), {
              skipCredits: increment(-1)
            });
          }
          if (nextIndex === members.length - 1) isCycleCompleted = true;
          nextIndex = (nextIndex + 1) % members.length;
          skipLoopCount++;
        }

        if (!isCycleCompleted && activeIdx === members.length - 1) isCycleCompleted = true;

        const roomUpdate: any = {
          lastBypasserUid: null,
          currentTurnIndex: nextIndex
        };
        if (isCycleCompleted) roomUpdate.cycleCount = increment(1);
        await updateDoc(doc(db, 'rooms', room.id), roomUpdate);

        nextMemberName = members[nextIndex].displayName;
        nextUserToNotify = members[nextIndex];
      }

      // Kirim WhatsApp ke orang berikutnya (Hanya jika diaktifkan di pengaturan)
      if (nextUserToNotify && nextUserToNotify.phoneNumber && settings?.isWANotificationsEnabled) {
        const currentDebtDisplay = (nextUserToNotify.uid === currentBuyer.uid && isPayingDebt && currentBuyer.bypassDebt! > 1)
          ? `(Sisa Utang: ${currentBuyer.bypassDebt! - 1} galon)`
          : "";

        const turnMessage = `💧 *GANTI GILIRAN GALON!*\n---\nHalo *${nextUserToNotify.displayName}*, giliran Anda untuk membeli galon di *${room.name}* telah tiba ${currentDebtDisplay}.\n\nMohon segera lakukan pembelian dan upload bukti fotonya di web AquaSchedule.\n\nTerima kasih!`;
        sendWA(nextUserToNotify.phoneNumber, turnMessage);
      }

      showToast(`BERHASIL! SELANJUTNYA: ${nextMemberName}`);
      setIsMethodModalOpen(false);
      setSelectedPhotos([]);
      setSelectedTukang(null);
      setIsDeliveryEnabled(false);
      setPurchaseCost(6000);
      setDescription('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleBypassTurn = async (substituteUid: string) => {
    if (!room || members.length === 0) return;
    setBypassing(true);
    try {
      const substituteIndex = members.findIndex(m => m.uid === substituteUid);
      const substitute = members[substituteIndex];
      if (!substitute) throw new Error("Pengganti tidak ditemukan");

      await updateDoc(doc(db, 'rooms', room.id), {
        currentTurnIndex: substituteIndex,
        lastBypasserUid: user.uid
      });

      const helpeeUpdate: any = {
        bypassQuota: increment(-1),
        bypassDebt: increment(1)
      };
      helpeeUpdate[`borrowedFrom.${substituteUid}`] = {
        name: substitute.displayName,
        count: (user.borrowedFrom?.[substituteUid]?.count || 0) + 1,
        lastDate: serverTimestamp()
      };
      await updateDoc(doc(db, 'users', user.uid), helpeeUpdate);

      const helperUpdate: any = { skipCredits: increment(1) };
      helperUpdate[`helpedBy.${user.uid}`] = {
        name: user.displayName,
        count: (substitute.helpedBy?.[user.uid]?.count || 0) + 1,
        lastDate: serverTimestamp()
      };
      await updateDoc(doc(db, 'users', substituteUid), helperUpdate);

      // Notifikasi ke pahlawan yang dipilih (Hanya jika diaktifkan di pengaturan)
      if (substitute.phoneNumber && settings?.isWANotificationsEnabled) {
        const bypassMsg = `⚠️ *BYPASS GILIRAN!*\n---\nHalo *${substitute.displayName}*, Si *${user.displayName}* melakukan bypass di *${room.name}*.\n\nMohon segera diproses ya. Semangat pahlawan asrama!`;
        sendWA(substitute.phoneNumber, bypassMsg);
      }

      showToast('Bypass berhasil! Anda mendapat hutang 1 galon.', 'info');
      setIsBypassModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBypassing(false);
    }
  };

  const openImageViewer = (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    setViewingImages(urls);
    setActiveViewIdx(0);
  };

  const handleToggleStatus = async () => {
    if (togglingStatus) return;
    setTogglingStatus(true);
    try {
      const newStatus: StudentStatus = (currentUserData?.status === 'cuti') ? 'aktif' : 'cuti';
      await updateDoc(doc(db, 'users', user.uid), { status: newStatus });
      showToast(newStatus === 'cuti' ? 'Status diubah ke CUTI - Giliran Anda akan dilompati' : 'Status diubah ke AKTIF - Anda kembali ke antrean normal', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTogglingStatus(false);
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
    if (!touchStart.current || !touchEnd.current || !viewingImages) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) setActiveViewIdx(prev => (prev + 1) % viewingImages.length);
    if (distance < -50) setActiveViewIdx(prev => (prev - 1 + viewingImages.length) % viewingImages.length);
  };

  const activeMember = members[room?.currentTurnIndex || 0];
  const isMyTurn = activeMember?.uid === user.uid;
  const currentUserData = members.find(m => m.uid === user.uid);
  const isCurrentInDebt = (activeMember?.bypassDebt || 0) > 0;

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Sinkronisasi Real-time...</p>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-10 max-w-6xl mx-auto pb-20 px-4 animate-slide-up">
      {/* Header Room Info */}
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-xl shadow-blue-900/5 border border-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="space-y-3 text-center md:text-left relative z-10">
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">{room?.name || "Kamar Galon"}</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rp {currentMonthSpend.toLocaleString()} Bulan Ini</span>
            </div>
            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:scale-105 transition-transform"
            >
              STATISTIK KAMAR
            </button>
            {availableTukang.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-black uppercase tracking-widest">{availableTukang.length} Tukang Online</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center relative z-10">
          <div className="text-center md:text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Metrik Pribadi</p>
            <div className="flex items-center justify-center md:justify-end space-x-4 md:space-x-6">
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-black text-blue-600">{currentUserData?.bypassQuota || 0}</span>
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">Kuota</span>
              </div>
              <div className="w-px h-10 bg-slate-100"></div>

              <div className="flex flex-col items-center group cursor-pointer" onClick={() => { setInsightTab('helping'); setIsInsightModalOpen(true); }}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xl md:text-3xl font-black transition-all ${currentUserData?.skipCredits ? 'text-emerald-500 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-slate-300'}`}>
                    {currentUserData?.skipCredits || 0}
                  </span>
                  <div className={`p-1 rounded-lg transition-all ${currentUserData?.skipCredits ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-slate-50 text-slate-300'}`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">Point Skip</span>
              </div>

              <div className="w-px h-10 bg-slate-100"></div>

              <div className="flex flex-col items-center group cursor-pointer" onClick={() => { setInsightTab('borrowing'); setIsInsightModalOpen(true); }}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xl md:text-3xl font-black transition-all ${currentUserData?.bypassDebt ? 'text-red-500 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'text-slate-200'}`}>
                    {currentUserData?.bypassDebt || 0}
                  </span>
                  <div className={`p-1 rounded-lg transition-all ${currentUserData?.bypassDebt ? 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white' : 'bg-slate-50 text-slate-200'}`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">Utang</span>
              </div>

              <div className="w-px h-10 bg-slate-100"></div>

              {/* Status Toggle */}
              <div className="flex flex-col items-center group">
                <button
                  onClick={handleToggleStatus}
                  disabled={togglingStatus}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 flex items-center px-1 hover-jelly ${currentUserData?.status === 'cuti' ? 'bg-amber-500 shadow-lg shadow-amber-200 animate-pulse-glow' : 'bg-emerald-500 shadow-lg shadow-emerald-200'}`}
                  style={{ '--tw-shadow-color': currentUserData?.status === 'cuti' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)' } as React.CSSProperties}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all duration-300 flex items-center justify-center ${currentUserData?.status === 'cuti' ? 'translate-x-7' : 'translate-x-0'} group-hover:scale-110`}>
                    {togglingStatus && <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                </button>
                <span className={`text-[8px] font-black uppercase tracking-wider mt-1 transition-all ${currentUserData?.status === 'cuti' ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                  {currentUserData?.status === 'cuti' ? 'CUTI' : 'AKTIF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-1 shadow-sm border border-slate-100 overflow-hidden">
            <div className={`p-8 md:p-12 rounded-[2.2rem] transition-all duration-500 ${isMyTurn ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 animate-pulse-glow' : 'bg-white text-slate-900'}`}>
              <div className="flex items-center space-x-6">
                <div className={`h-24 w-24 md:h-32 md:w-32 rounded-[2.2rem] flex items-center justify-center font-black text-3xl md:text-5xl shadow-lg border-2 overflow-hidden transition-all ${isMyTurn ? 'bg-white text-blue-600 scale-105 border-white/40 animate-breathe' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                  {activeMember?.photoUrl ? <img src={activeMember.photoUrl} className="w-full h-full object-cover" /> : activeMember?.displayName?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <h4 className={`text-[10px] font-black uppercase tracking-widest ${isMyTurn ? 'text-blue-100' : 'text-slate-400'}`}>Penanggung Jawab Sekarang</h4>
                  <p className="text-3xl md:text-5xl font-black tracking-tighter mt-1">{activeMember?.displayName || '...'}</p>

                  {activeDelivery ? (
                    <div className="mt-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 inline-flex items-center gap-3 animate-pulse">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-widest">Pesanan Ke {activeDelivery.tukangGalonName}: {activeDelivery.status.toUpperCase()}</span>
                    </div>
                  ) : isCurrentInDebt && (
                    <div className="mt-3 px-3 py-1 bg-red-500 text-white inline-block rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">Sedang Melunasi Utang</div>
                  )}

                  {isMyTurn && !activeDelivery && (
                    <div className="flex flex-wrap gap-3 mt-5">
                      {(currentUserData?.bypassQuota || 0) > 0 && !room?.lastBypasserUid && !isCurrentInDebt && (
                        <button onClick={() => setIsBypassModalOpen(true)} className="px-5 py-2 bg-amber-400 text-amber-900 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-amber-300 transition-all">Gunakan Bypass</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isMyTurn && !activeDelivery && (
              <div className="p-8 md:p-12 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Berapa Biaya Galon Hari Ini?</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">Rp</span>
                    <input
                      type="number"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Number(e.target.value))}
                      className="w-full h-[72px] pl-16 pr-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-black text-slate-900 text-2xl input-focus-glow"
                    />
                  </div>
                </div>

                <button
                  onClick={() => { setIsMethodModalOpen(true); setSelectedPhotos([]); setSelectedTukang(null); setIsDeliveryEnabled(false); }}
                  className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-[1.8rem] font-black text-xl transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-[0.98] btn-hover-lift ripple hover-jelly"
                >
                  KONFIRMASI GILIRAN <svg className="w-6 h-6 hover-wiggle" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Riwayat Pembelian Bulan Ini</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {currentMonthHistory.length === 0 ? (
                <div className="col-span-full py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest italic">Belum ada pembelian bulan ini</div>
              ) : (
                currentMonthHistory.map((h, idx) => (
                  <div key={h.id} className={`bg-slate-50 rounded-[2rem] p-4 flex flex-col gap-4 group hover:bg-white hover:shadow-lg transition-all border border-transparent card-hover animate-fade-in-up stagger-${Math.min(idx + 1, 5)}`}>
                    <div className="flex gap-4 items-center">
                      <div
                        onClick={() => openImageViewer(h.photoUrls)}
                        className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 cursor-pointer relative bg-slate-200"
                      >
                        {h.photoUrls && h.photoUrls.length > 0 ? (
                          <img src={h.photoUrls?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg></div>
                        )}
                        {h.photoUrls && h.photoUrls.length > 1 && (
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] font-black px-1 rounded-md backdrop-blur-sm">
                            +{h.photoUrls.length - 1}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-slate-900 truncate leading-none text-sm">{h.buyerName}</p>
                          {h.isDebtPayment && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[7px] font-black uppercase rounded-md border border-red-100">Pelunasan Utang</span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold mt-1.5">{formatDate(h.timestamp)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] font-black text-blue-600">Rp {h.cost.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="w-full mt-8 py-4 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Lihat Seluruh Arsip Pembelian
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white sticky top-28 shadow-2xl overflow-hidden">
            <h3 className="text-lg font-black mb-6 flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Antrean Asrama
            </h3>
            <div className="space-y-3">
              {members.map((m, i) => {
                const isActive = i === (room?.currentTurnIndex || 0);
                const isCuti = m.status === 'cuti';
                return (
                  <div key={m.uid} className={`flex items-center justify-between p-4 rounded-2xl transition-all ${isActive ? 'bg-blue-600 scale-105 shadow-lg' : isCuti ? 'bg-white/5 opacity-40' : 'bg-white/5 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-[10px] overflow-hidden ${isCuti ? 'grayscale' : ''}`}>
                        {m.photoUrl ? <img src={m.photoUrl} className="w-full h-full object-cover" /> : m.displayName?.charAt(0)}
                      </div>
                      <p className={`text-xs font-black truncate ${isActive ? 'text-white' : isCuti ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{m.displayName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCuti && <span className="text-[7px] font-black bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">CUTI</span>}
                      {isActive && !isCuti && <span className="text-[8px] font-black bg-white/20 px-2 py-1 rounded-full">AKTIF</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isInsightModalOpen} onClose={() => setIsInsightModalOpen(false)} title="Dashboard Insight & Riwayat" maxWidth="max-w-md">
        <div className="space-y-8">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setInsightTab('helping')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${insightTab === 'helping' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}
            >
              Orang Yang Saya Bantu
            </button>
            <button
              onClick={() => setInsightTab('borrowing')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${insightTab === 'borrowing' ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}
            >
              Pahlawan Yang Menolong Saya
            </button>
          </div>

          {insightTab === 'helping' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 text-center relative overflow-hidden">
                <div className="w-16 h-16 bg-emerald-500 rounded-[1.8rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200 border-4 border-white text-white">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                </div>
                <h4 className="text-emerald-900 font-black text-xl mb-1 uppercase tracking-wider">REKAP POINT SKIP 🏆</h4>
                <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest">Daftar teman yang gilirannya Anda ambil alih sehingga Anda mendapat poin.</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {currentUserData?.helpedBy && Object.entries(currentUserData.helpedBy).length > 0 ? (
                  Object.entries(currentUserData.helpedBy).map(([helpeeUid, data]: [string, any]) => (
                    <div key={helpeeUid} className="flex flex-col p-5 bg-white border border-slate-100 rounded-[1.8rem] shadow-sm hover:border-emerald-200 transition-all gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-sm text-slate-300">
                            {data.name.charAt(0)}
                          </div>
                          <p className="text-sm font-black text-slate-900">{data.name}</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                          {data.count}x Bantu
                        </div>
                      </div>
                      {data.lastDate && (
                        <div className="flex justify-end mt-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] italic">Terakhir Membantu: {formatDate(data.lastDate)}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase italic">Anda belum pernah mengambil giliran orang lain</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 text-center relative overflow-hidden">
                <div className="w-16 h-16 bg-red-500 rounded-[1.8rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-200 border-4 border-white text-white">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h4 className="text-red-900 font-black text-xl mb-1 uppercase tracking-wider">REKAP HUTANG 💸</h4>
                <p className="text-red-600 text-[10px] font-black uppercase tracking-widest">Daftar pahlawan asrama yang bersedia menolong saat Anda bypass.</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {currentUserData?.borrowedFrom && Object.entries(currentUserData.borrowedFrom).length > 0 ? (
                  Object.entries(currentUserData.borrowedFrom).map(([helperUid, data]: [string, any]) => (
                    <div key={helperUid} className="flex flex-col p-5 bg-white border border-slate-100 rounded-[1.8rem] shadow-sm hover:border-red-200 transition-all gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-sm text-slate-300">
                            {data.name.charAt(0)}
                          </div>
                          <p className="text-sm font-black text-slate-900">{data.name}</p>
                        </div>
                        <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                          {data.count}x Utang
                        </div>
                      </div>
                      {data.lastDate && (
                        <div className="flex justify-end mt-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] italic">Terakhir Ngutang: {formatDate(data.lastDate)}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase italic">Anda belum pernah melakukan bypass</div>
                )}
              </div>
            </div>
          )}

          <button onClick={() => setIsInsightModalOpen(false)} className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all">Tutup Riwayat Interaksi</button>
        </div>
      </Modal>

      {/* STATS & ARCHIVE MODAL */}
      <Modal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} title="Dashboard Statistik & Arsip Pembelian" maxWidth="max-w-4xl">
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Belanja Seluruh Waktu</p>
              <h4 className="text-3xl font-black">Rp {totalRoomSpend.toLocaleString()}</h4>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Unit Terbeli</p>
              <h4 className="text-3xl font-black text-slate-900">{history.length} <span className="text-sm text-slate-400 font-bold uppercase">Galon</span></h4>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h5 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">🏆 Pahlawan & Juara Kamar</h5>
              <div className="h-px bg-slate-100 flex-1 mx-4"></div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center relative">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">
                  {stats.topBuyer ? stats.topBuyer[0].charAt(0) : '?'}
                </div>
                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">JUARA GALON</p>
                <p className="text-md font-black text-slate-900 truncate">{stats.topBuyer ? stats.topBuyer[0] : 'Belum ada'}</p>
              </div>
              <div className="flex-1 bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center relative">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">
                  {stats.topHelper ? stats.topHelper[0].charAt(0) : '?'}
                </div>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">PAHLAWAN (HELPER)</p>
                <p className="text-md font-black text-slate-900 truncate">{stats.topHelper ? stats.topHelper[0] : 'Belum ada'}</p>
              </div>
              <div className="flex-1 bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center relative">
                <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">
                  {stats.mostHelped ? stats.mostHelped[0].charAt(0) : '?'}
                </div>
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">MOST HELPED</p>
                <p className="text-md font-black text-slate-900 truncate">{stats.mostHelped ? stats.mostHelped[0] : 'Belum ada'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h5 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">📝 Log Seluruh Pembelian (Arsip Foto)</h5>
              <div className="h-px bg-slate-100 flex-1 mx-4"></div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                {history.length === 0 ? (
                  <div className="py-20 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest italic">Belum Ada Riwayat Tersimpan</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pembeli</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Biaya</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Akses Bukti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map(h => (
                        <tr key={h.id} className="bg-white hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[10px] font-bold text-slate-500">{formatDate(h.timestamp, true)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <p className="text-xs font-black text-slate-900 leading-tight">{h.buyerName}</p>
                              {h.isDebtPayment && <span className="text-[7px] font-black text-red-500 uppercase">Pelunasan Utang</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-black text-blue-600">Rp {h.cost.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => openImageViewer(h.photoUrls)}
                                className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                                title="Lihat Bukti Siswa (Uang/Bon)"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                <span className="hidden lg:block text-[8px] font-black uppercase tracking-widest">Bukti Siswa</span>
                              </button>
                              {h.deliveryProofUrls && h.deliveryProofUrls.length > 0 && (
                                <button
                                  onClick={() => openImageViewer(h.deliveryProofUrls!)}
                                  className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                                  title="Lihat Bukti Kurir (Galon Sampai)"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  <span className="hidden lg:block text-[8px] font-black uppercase tracking-widest">Bukti Kurir</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsStatsModalOpen(false)}
            className="w-full bg-slate-900 text-white py-6 rounded-[2.2rem] font-black text-[11px] uppercase tracking-widest"
          >
            Keluar Ke Dashboard
          </button>
        </div>
      </Modal>

      <Modal isOpen={isMethodModalOpen} onClose={() => setIsMethodModalOpen(false)} title="Konfirmasi Pengambilan Galon" maxWidth="max-w-2xl">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LANGKAH 1: UNGGAH BUKTI FOTO (WAJIB)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center hover:bg-blue-50/50 transition-all cursor-pointer group">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileChange} />
                <svg className="w-8 h-8 text-slate-300 group-hover:text-blue-600 mb-2 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0010.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                <span className="text-[9px] font-black text-slate-400 group-hover:text-blue-600 uppercase">Ketuk Untuk Memotret</span>
              </div>
              <div className="h-40 bg-white border border-slate-100 rounded-[2rem] p-4 overflow-y-auto custom-scrollbar">
                {selectedPhotos.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[8px] font-black text-slate-300 uppercase italic">Preview Bukti Muncul Disini</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPhotos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm group">
                        <img src={photo} className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LANGKAH 2: CATATAN TAMBAHAN (OPSIONAL)</p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: uangnya saya bayar pakai dana ya pak..."
              className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all font-bold text-slate-900 text-sm placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LANGKAH 3: PILIH PETUGAS PENGANTAR</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${!isDeliveryEnabled ? 'text-slate-900' : 'text-slate-300'}`}>Ambil Sendiri</span>
                <button
                  onClick={() => {
                    setIsDeliveryEnabled(!isDeliveryEnabled);
                    if (isDeliveryEnabled) setSelectedTukang(null);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${isDeliveryEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDeliveryEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
                <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isDeliveryEnabled ? 'text-blue-600' : 'text-slate-300'}`}>Pakai Kurir</span>
              </div>
            </div>

            {isDeliveryEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                {availableTukang.length === 0 ? (
                  <div className="col-span-full py-10 bg-slate-50 border border-slate-100 rounded-[2rem] text-center italic text-[9px] font-black text-slate-300 uppercase">Tidak Ada Tukang Aktif</div>
                ) : (
                  <>
                    {availableTukang.map(tukang => (
                      <button
                        key={tukang.uid}
                        onClick={() => setSelectedTukang(tukang)}
                        className={`p-4 rounded-[1.5rem] flex items-center justify-between border-2 transition-all ${selectedTukang?.uid === tukang.uid ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-900'}`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-9 w-9 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                            {tukang.photoUrl ? <img src={tukang.photoUrl} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300">{tukang.displayName.charAt(0)}</div>}
                          </div>
                          <p className="text-xs font-black truncate">{tukang.displayName}</p>
                        </div>
                        {selectedTukang?.uid === tukang.uid && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedTukang({ uid: 'broadcast', displayName: 'Siapa Saja' } as any)}
                      className={`p-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest border-2 transition-all ${selectedTukang?.uid === 'broadcast' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-dashed border-slate-200 text-slate-400'}`}
                    >
                      Pilih Siapa Saja
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
            <button
              onClick={handleFinalSubmit}
              disabled={uploading || isCompressing || selectedPhotos.length === 0 || (isDeliveryEnabled && !selectedTukang)}
              className={`w-full py-6 rounded-[1.8rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${selectedPhotos.length > 0 && (!isDeliveryEnabled || selectedTukang) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400'}`}
            >
              {uploading ? 'MEMPROSES...' : 'SIMPAN GILIRAN SEKARANG'}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </button>
            <button onClick={() => setIsMethodModalOpen(false)} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 py-2 text-center">Batal / Kembali</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBypassModalOpen} onClose={() => setIsBypassModalOpen(false)} title="Konfirmasi Bypass">
        <div className="space-y-6 text-center">
          <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
            <p className="text-sm font-black text-amber-900 leading-relaxed">Gunakan 1 jatah bypass? Anda akan mendapatkan <span className="text-red-600">HUTANG 1 GALON</span>.</p>
          </div>
          <div className="space-y-2">
            {members.filter(m => m.uid !== user.uid).map(m => (
              <button key={m.uid} onClick={() => handleBypassTurn(m.uid)} disabled={bypassing} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-500 transition-all font-black text-slate-700">{m.displayName}</button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={viewingImages !== null} onClose={() => { setViewingImages(null); setActiveViewIdx(0); }} title="Peninjau Foto Bukti" maxWidth="max-w-4xl">
        {viewingImages && viewingImages.length > 0 && (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div
              className="relative w-full overflow-hidden rounded-[2.5rem] group cursor-grab active:cursor-grabbing"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="flex transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)"
                style={{ transform: `translateX(-${activeViewIdx * 100}%)` }}
              >
                {viewingImages.map((img, idx) => (
                  <div key={idx} className="min-w-full flex justify-center items-center bg-slate-50/50 p-4">
                    <img src={img} className="max-w-full max-h-[60vh] object-contain shadow-2xl border-4 border-white rounded-[2rem] select-none pointer-events-none" alt={`Bukti ${idx + 1}`} />
                  </div>
                ))}
              </div>
              {viewingImages.length > 1 && (
                <>
                  <button onClick={() => setActiveViewIdx((activeViewIdx - 1 + viewingImages.length) % viewingImages.length)} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white hidden md:block">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setActiveViewIdx((activeViewIdx + 1) % viewingImages.length)} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white hidden md:block">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-6">
              {viewingImages.length > 1 && (
                <div className="flex gap-2 justify-center">
                  {viewingImages.map((_, i) => (
                    <button key={i} onClick={() => setActiveViewIdx(i)} className={`h-2 rounded-full transition-all duration-500 ${i === activeViewIdx ? 'bg-blue-600 w-10' : 'bg-slate-200 w-2'}`} />
                  ))}
                </div>
              )}
              <button onClick={() => { setViewingImages(null); setActiveViewIdx(0); }} className="w-full bg-slate-900 text-white py-5 rounded-[1.8rem] font-black text-xs uppercase shadow-lg tracking-widest active:scale-95 transition-transform">TUTUP ARSIP</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentDashboard;
