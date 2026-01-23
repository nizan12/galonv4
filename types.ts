export type UserRole = 'admin' | 'student' | 'tukang_galon';
export type StudentStatus = 'aktif' | 'cuti';

export interface InteractionRecord {
  name: string;
  count: number;
  lastDate?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  roomId: string | null;
  turnOrder: number;
  photoUrl?: string;
  phoneNumber?: string;
  bypassQuota: number;
  maxBypassQuota: number;
  skipCredits: number;
  bypassDebt: number;
  helpedBy?: {
    [uid: string]: InteractionRecord
  };
  borrowedFrom?: {
    [uid: string]: InteractionRecord
  };
  lastQuotaReset?: string;
  isOnline?: boolean;
  status?: StudentStatus; // 'aktif' | 'cuti' - default: 'aktif'
}

export interface Room {
  id: string;
  name: string;
  currentTurnIndex: number;
  memberUids: string[];
  lastBypasserUid?: string | null;
  cycleCount?: number;
}

export interface AppSettings {
  logoUrl?: string;
  appName?: string;
  isWANotificationsEnabled?: boolean;
}

export interface PurchaseHistory {
  id: string;
  buyerUid: string;
  buyerName: string;
  roomId: string;
  roomName: string;
  photoUrls: string[];
  deliveryProofUrls?: string[];
  timestamp: any;
  cost: number;
  description?: string;
  isBypassTask?: boolean;
  isDebtPayment?: boolean;
  orderId?: string;
}

export interface DeliveryOrder {
  id: string;
  roomId: string;
  roomName: string;
  buyerUid: string;
  buyerName: string;
  status: 'pending' | 'processing' | 'delivered' | 'cancelled';
  cost: number;
  description?: string;
  timestamp: any;
  deliveredAt?: any;
  tukangGalonUid?: string | null;
  tukangGalonName?: string | null;
  photoUrls?: string[];
  deliveryProofUrls?: string[];
  purchaseId?: string;
}