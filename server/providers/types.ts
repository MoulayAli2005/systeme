export interface ShippingProvider {
  readonly name: string;
  configured: boolean;
  createShipment(input: {
    orderId: string;
    city: string;
    address: string;
    phone: string;
    codAmount: number;
    weightGrams?: number;
  }): Promise<{ awb: string; trackingUrl?: string; raw?: unknown }>;
  cancelShipment(awb: string): Promise<void>;
  trackShipment(awb: string): Promise<{ status: string; detail?: string }>;
  printLabel(awb: string): Promise<{ url?: string; message: string }>;
}

export interface MessagingProvider {
  readonly name: string;
  readonly channel: "whatsapp" | "sms";
  configured: boolean;
  sendMessage(input: {
    to: string;
    text: string;
    template?: string;
  }): Promise<{ id: string; status: string }>;
}

export interface EmailProvider {
  readonly name: string;
  configured: boolean;
  send(input: { to: string; subject: string; text: string }): Promise<{ id: string }>;
}

export interface PhoneProvider {
  readonly name: string;
  configured: boolean;
  makeCall(input: { to: string; from?: string; orderId?: string }): Promise<{ id: string; status: string }>;
  getCallStatus(id: string): Promise<{ status: string; durationSec?: number }>;
}

export interface StoreProvider {
  readonly name: string;
  configured: boolean;
  listOrders(since?: Date): Promise<unknown[]>;
  listProducts(): Promise<unknown[]>;
  updateOrderStatus(externalId: string, status: string): Promise<void>;
}

export interface AdsProvider {
  readonly name: string;
  configured: boolean;
  getCampaigns(): Promise<Array<{ id: string; name: string; spend: number }>>;
}

export interface AiProvider {
  readonly name: string;
  configured: boolean;
  complete(prompt: string, context?: string): Promise<string>;
}

export class NotConnectedError extends Error {
  code = "INTEGRATION_NOT_CONNECTED";
  constructor(provider: string) {
    super(`${provider} is not configured. Add credentials in Settings → Integrations.`);
  }
}
