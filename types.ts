
export interface ServiceExpense {
  id: string;
  description: string; // ej: "Rectificación de culata", "Pastillas de freno"
  amount: number;
}

export interface ServicePayment {
  id: string;
  amount: number;
  date: string;
  type: 'advance' | 'final';
  description: string;
}

export interface Service {
  id: string;
  clientName: string;
  phone?: string;
  plate: string;
  brand: string;
  model: string;
  reason: string;
  
  // Financials
  price: number; // Legacy compatibility (Base Labor)
  laborItems?: ServiceExpense[];
  expenses?: ServiceExpense[];
  
  advance?: number;
  payments?: ServicePayment[]; // New field for detailed payment tracking
  
  // Media
  photos?: string[]; // Array of base64 strings
  
  entryDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
}

export interface Cost {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: 'parts' | 'labor' | 'utilities' | 'other';
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  clientName: string;
  phone?: string;
  vehicle: string; // Brand + Model + Plate
  date: string;
  
  // Split structure
  laborItems?: QuoteItem[];
  expenseItems?: QuoteItem[];
  items?: QuoteItem[]; // Legacy fallback
  
  notes?: string;
  total: number;
  validityDays: number;
  
  // New field for workflow
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  groundingMetadata?: any;
}

export interface AppSettings {
  themeColor: 'blue' | 'purple' | 'emerald' | 'orange' | 'red';
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  logoUrl?: string; // Base64 string of the logo
  whatsappServiceTemplate: string;
  whatsappQuoteTemplate: string;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  SERVICES = 'services',
  QUOTES = 'quotes',
  COSTS = 'costs',
  SETTINGS = 'settings'
}