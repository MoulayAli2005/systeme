export type OrderStatus =
  | "new"
  | "pending_confirmation"
  | "confirmed"
  | "cancelled"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery"
  | "rto"
  | "returned"
  | "exchanged";

export type PaymentMethod = "cod" | "prepaid";
export type Channel = "whatsapp" | "instagram" | "email" | "call" | "ai";
export type StoreSource =
  | "shopify"
  | "woocommerce"
  | "youcan"
  | "facebook"
  | "tiktok"
  | "manual"
  | "sheets";

export type AgentRole =
  | "owner"
  | "confirmation"
  | "inbox"
  | "shipping"
  | "returns"
  | "marketing";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  variant: string;
  price: number;
  stock: number;
  category: string;
  imageHue: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  variant: string;
  qty: number;
  price: number;
}

export interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone?: "default" | "success" | "warn" | "danger";
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  source: StoreSource;
  assignedTo?: string;
  carrierId?: string;
  awb?: string;
  confirmationChannel?: Channel;
  notes?: string;
  timeline: TimelineEvent[];
  rtoReason?: string;
}

export interface Message {
  id: string;
  at: string;
  from: "customer" | "agent" | "ai" | "system";
  text: string;
  buttons?: string[];
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  city: string;
  channel: Channel;
  unread: number;
  lastMessage: string;
  lastAt: string;
  messages: Message[];
  orderId?: string;
  assignedTo?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  email: string;
  initials: string;
  online: boolean;
  confirmedToday: number;
  avgConfirmMin: number;
  hue: number;
}

export interface Carrier {
  id: string;
  name: string;
  connected: boolean;
  pickupWindow: string;
  cities: string[];
  deliveredRate: number;
  avgDays: number;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  condition: string;
  action: string;
  runsToday: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sent";
  audience: string;
  sent: number;
  delivered: number;
  replied: number;
  converted: number;
  scheduledAt?: string;
  template: string;
}

export interface Integration {
  id: string;
  name: string;
  kind: "store" | "carrier" | "ads" | "channel" | "sheet";
  connected: boolean;
  detail: string;
}

export interface Manifest {
  id: string;
  carrierId: string;
  createdAt: string;
  orderIds: string[];
  pickupAt: string;
  status: "ready" | "picked_up" | "closed";
}

export interface AppState {
  orders: Order[];
  products: Product[];
  conversations: Conversation[];
  agents: Agent[];
  carriers: Carrier[];
  automations: Automation[];
  campaigns: Campaign[];
  integrations: Integration[];
  manifests: Manifest[];
  ai: {
    enabled: boolean;
    name: string;
    languages: string[];
    tone: string;
    canConfirm: boolean;
    canCancel: boolean;
    canUpsell: boolean;
    knowledge: string;
  };
}

export interface Session {
  name: string;
  email: string;
  role: AgentRole;
}
