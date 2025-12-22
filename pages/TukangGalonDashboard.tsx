import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { UserProfile, Room, DeliveryOrder } from '../types';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { sendWA } from '../utils/whatsapp';

interface TukangGalonDashboardProps {
  user: UserProfile;
}

const TukangGalonDashboard: React.FC<TukangGalonDashboardProps> = ({ user }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buyerPhones, setBuyerPhones] = useState<{[uid: string]: string}>({});
  const [isOnline, setIsOnline] = useState(user.isOnline || false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'incoming' | 'processing' | 'completed'>('incoming');
  
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [activeViewIdx, setActiveViewIdx] = useState(0);

  const [confirmingOrder, setConfirmingOrder] = useState<DeliveryOrder | null>(null);
  const [completingOrder, setCompletingOrder] = useState<DeliveryOrder | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Swipe detection refs
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  useEffect(() => {
    const qOrders = query(collection(db, 'delivery_orders'), orderBy('timestamp', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as DeliveryOrder));
      setOrders(ordersData);
      setLoading(false);
    });

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Room)));
    });

    return () => {
      unsubOrders();
      unsubRooms();
    };
  }, []);

  useEffect(() => {
    const fetchMissingPhones = async () => {
      const uniqueBuyerUids: string[] = Array.from(new Set(orders.map(o => o.buyerUid)));
      const newPhones: {[uid: string]: string} = { ...buyerPhones };
      let updated = false;

      for (const uid of uniqueBuyerUids) {
        if (!newPhones[uid]) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            newPhones[uid] = userDoc.data().phoneNumber || '';
            updated = true;
          }
        }
      }

      if (updated) {
        setBuyerPhones(newPhones);
      }
    };

    if (orders.length > 0) {
      fetchMissingPhones();
    }
  }, [orders]);

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isOnline: newStatus });
      showToast(newStatus ? 'Anda sekarang ONLINE' : 'Anda sekarang OFFLINE', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeliveryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    // Compression logic would go here
    setIsCompressing(false);
  };

  const removeDeliveryPhoto = (index: number) => {
    setDeliveryPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: DeliveryOrder['status'], extraData: any = {}) => {
    setIsActionLoading(true);
    try {
      const order = orders.find(o => o.id === orderId);
      const studentPhone = order ? buyerPhones[order.buyerUid] : null;

      const updateData: any = { 
        status: newStatus,
        ...extraData
      };

      if (newStatus === 'delivered' || newStatus === 'processing') {
        updateData.tukangGalonUid = user.uid;
        updateData.tukangGalonName = user.displayName;
      }
      if (newStatus === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'delivery_orders', orderId), updateData);
      
      if (newStatus === 'delivered' && (order?.purchaseId || completingOrder?.purchaseId)) {
        const pId = order?.purchaseId || completingOrder?.purchaseId;
        await updateDoc(doc(db, 'purchases', pId!), {
          deliveryProofUrls: extraData.deliveryProofUrls || []
        });
      }

      if (studentPhone) {
        let waMessage = '';
        if (newStatus === 'processing') {
          waMessage = `🚚 *PESANAN SEDANG DIPROSES!*\n---\nHalo *${order?.buyerName}*, pesanan galon untuk *${order?.roomName}* sedang diproses oleh *${user.displayName}*. Mohon ditunggu ya!`;
        } else if (newStatus === 'delivered') {
          waMessage = `✅ *GALON SUDAH SAMPAI!*\n---\nHalo *${order?.buyerName}*, galon untuk *${order?.roomName}* sudah diletakkan di lokasi oleh *${user.displayName}*. Bukti foto pengantaran bisa dicek di aplikasi. Terima kasih!`;
        }
        
        if (waMessage) await sendWA(studentPhone, waMessage);
      }

      showToast(`Berhasil: Pesanan ${newStatus === 'delivered' ? 'Telah Sampai' : 'Sedang Diproses'}`);
      setConfirmingOrder(null);
      setCompletingOrder(null);
      setDeliveryPhotos([]);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const openWA = (phone: string, roomName: string) => {
    if (!phone) return;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
    else if (!cleaned.startsWith('62')) cleaned = '62' + cleaned;
    const msg = encodeURIComponent(`Halo, saya *${user.displayName}* (Kurir Galon). Saya sedang memproses pesanan untuk *${roomName}*.`);
    window.open(`https://wa.me/${cleaned}?text=${msg}`, '_blank');
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

  const incomingOrders = useMemo(() => orders.filter(o => o.status === 'pending' && (o.tukangGalonUid === user.uid || o.tukangGalonUid === null)), [orders, user.uid]);
  const processingOrders = useMemo(() => orders.filter(o => o.status === 'processing' && o.tukangGalonUid === user.uid), [orders, user.uid]);
  const completedOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return orders.filter(o => o.status === 'delivered' && (o.tukangGalonUid === user.uid) && (o.deliveredAt?.toDate() >= today || !o.deliveredAt));
  }, [orders, user.uid]);

  const stats = useMemo(() => ({ todayCount: completedOrders.length, totalEarnings: completedOrders.reduce((acc, curr) => acc + curr.cost, 0) }), [completedOrders]);

  const openImageViewer = (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    setViewingImages(urls);
    setActiveViewIdx(0);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Memuat Portal Tugas...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Halo, {user.displayName}!</h1>
              <div className="flex items-center gap-4 mt-4">
                <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Galon Terantar</p>
                  <p className="text-xl font-black text-emerald-400">{stats.todayCount} Unit</p>
                </div>
              </div>
            </div>
            <button 
              onClick={toggleOnline}
              className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 ${isOnline ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
            >
              <div className={`w-3 h-3 rounded-full animate-pulse ${isOnline ? 'bg-white' : 'bg-red-500'}`}></div>
              {isOnline ? 'STATUS: ONLINE' : 'STATUS: OFFLINE'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-1 shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex bg-slate-50 p-2 rounded-[2.2rem] gap-2">
          {['incoming', 'processing', 'completed'].map(tabId => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId as any)}
              className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tabId ? 'bg-white text-slate-900 shadow-lg scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tabId === 'incoming' ? 'Masuk' : tabId === 'processing' ? 'Proses' : 'Selesai'}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'incoming' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
              {incomingOrders.map(order => (
                <div key={order.id} className="bg-slate-50 border border-slate-100 rounded-3xl p-6 hover:bg-white hover:shadow-xl transition-all flex flex-col h-full">
                  <h3 className="text-xl font-black text-slate-900 mb-1">{order.roomName}</h3>
                  {order.photoUrls && order.photoUrls.length > 0 && (
                    <div onClick={() => openImageViewer(order.photoUrls || [])} className="mb-4 aspect-video bg-slate-200 rounded-xl overflow-hidden cursor-pointer relative">
                       <img src={order.photoUrls[0]} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <button onClick={() => setConfirmingOrder(order)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest tracking-widest">TERIMA</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={viewingImages !== null} onClose={() => { setViewingImages(null); setActiveViewIdx(0); }} title="Bukti Transaksi" maxWidth="max-w-4xl">
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
                    <img 
                      src={img} 
                      className="max-w-full max-h-[60vh] object-contain shadow-2xl border-4 border-white rounded-[2rem] pointer-events-none select-none" 
                      alt={`Bukti ${idx + 1}`} 
                    />
                  </div>
                ))}
              </div>
              
              {viewingImages.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveViewIdx((activeViewIdx - 1 + viewingImages.length) % viewingImages.length)}
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white hidden md:block"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button 
                    onClick={() => setActiveViewIdx((activeViewIdx + 1) % viewingImages.length)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/90 backdrop-blur rounded-full text-slate-900 shadow-xl opacity-0 md:group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white hidden md:block"
                  >
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
               <div className="flex flex-col items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeViewIdx + 1} dari {viewingImages.length} Foto</p>
                 <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-2 italic">Geser gambar untuk navigasi</p>
               </div>
               <button onClick={() => { setViewingImages(null); setActiveViewIdx(0); }} className="w-full bg-slate-900 text-white py-5 rounded-[1.8rem] font-black text-xs uppercase shadow-lg tracking-widest active:scale-95 transition-transform">TUTUP ARSIP</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TukangGalonDashboard;