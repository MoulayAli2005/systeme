import { randomUUID } from "crypto";
import { env, isDemo } from "../env";
import { NotConnectedError } from "./types";
import {
  GenericHttpCarrier,
  SendGridEmail,
  TwilioSms,
  TwilioVoice,
  TwilioWhatsApp,
} from "./live";
import type {
  AdsProvider,
  AiProvider,
  EmailProvider,
  MessagingProvider,
  PhoneProvider,
  ShippingProvider,
  StoreProvider,
} from "./types";

export class DemoShipping implements ShippingProvider {
  name = "demo-carrier";
  configured = true;
  async createShipment(input: { city: string; codAmount: number }) {
    const awb = `NX${Date.now().toString().slice(-10)}${input.city.slice(0, 2).toUpperCase()}`;
    return { awb, trackingUrl: `/t/${awb}`, raw: { demo: true, cod: input.codAmount } };
  }
  async cancelShipment() {}
  async trackShipment(awb: string) {
    return { status: "in_transit", detail: `Demo tracking for ${awb}` };
  }
  async printLabel(awb: string) {
    return { message: `Demo label for ${awb} — connect a carrier to print real labels.` };
  }
}

export class DemoMessaging implements MessagingProvider {
  constructor(public channel: "whatsapp" | "sms") {}
  name = `demo-${this.channel}`;
  configured = true;
  async sendMessage() {
    return { id: `demo_${randomUUID()}`, status: isDemo ? "demo_logged" : "sent" };
  }
}

export class DemoEmail implements EmailProvider {
  name = "demo-email";
  configured = true;
  async send() {
    return { id: `demo_${randomUUID()}` };
  }
}

export class DemoPhone implements PhoneProvider {
  name = "demo-phone";
  configured = true;
  async makeCall() {
    return { id: `call_${randomUUID()}`, status: "demo_dial" };
  }
  async getCallStatus() {
    return { status: "completed", durationSec: 42 };
  }
}

export class DemoStore implements StoreProvider {
  name = "demo-store";
  configured = true;
  async listOrders() {
    return [];
  }
  async listProducts() {
    return [];
  }
  async updateOrderStatus() {}
}

export class DemoAds implements AdsProvider {
  name = "demo-ads";
  configured = true;
  async getCampaigns() {
    return [{ id: "demo", name: "Demo spend", spend: 0 }];
  }
}

export class DemoAi implements AiProvider {
  name = "demo-ai";
  configured = true;
  async complete(prompt: string, context = "") {
    const q = prompt.toLowerCase();
    if (q.includes("livr") || q.includes("deliver")) {
      return "Je n’ai accès qu’au résumé fourni. Filtrez Analytics → Delivered pour le chiffre exact du jour.";
    }
    if (q.includes("marge") || q.includes("margin") || q.includes("profit")) {
      return "Ouvrez Analytics → Products. Les produits sont classés par marge nette (revenu − coût − shipping − ads).";
    }
    if (q.includes("retour") || q.includes("return")) {
      return "Les retours se concentrent souvent sur les tailles. Utilisez Returns et filtrez par SKU.";
    }
    return `Mode démo (${this.name}). ${context ? "Contexte chargé. " : ""}Connectez OPENAI_API_KEY pour un assistant réel.\n\nQuestion: ${prompt.slice(0, 280)}`;
  }
}

export class OpenAiCompatible implements AiProvider {
  name = "openai";
  configured = Boolean(env.OPENAI_API_KEY);
  async complete(prompt: string, context = "") {
    if (!env.OPENAI_API_KEY) throw new NotConnectedError("OpenAI");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Nexora, a COD e-commerce operations copilot. Answer in the user's language. Use only the provided context for numbers.",
          },
          { role: "user", content: `${context}\n\n${prompt}` },
        ],
      }),
    });
    if (!res.ok) throw new Error("AI provider error");
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? "";
  }
}

export function shippingProvider(): ShippingProvider {
  const live = new GenericHttpCarrier();
  if (live.configured) return live;
  return new DemoShipping();
}

export function messagingProvider(channel: "whatsapp" | "sms"): MessagingProvider {
  if (channel === "sms") {
    const live = new TwilioSms();
    if (live.configured) return live;
  } else {
    const live = new TwilioWhatsApp();
    if (live.configured) return live;
  }
  return new DemoMessaging(channel);
}

export function emailProvider(): EmailProvider {
  const live = new SendGridEmail();
  if (live.configured) return live;
  return new DemoEmail();
}

export function phoneProvider(): PhoneProvider {
  const live = new TwilioVoice();
  if (live.configured) return live;
  return new DemoPhone();
}

export function providerStatus() {
  return {
    shipping: shippingProvider(),
    sms: messagingProvider("sms"),
    whatsapp: messagingProvider("whatsapp"),
    email: emailProvider(),
    phone: phoneProvider(),
    ai: aiProvider(),
    demoMode: isDemo,
  };
}

export function aiProvider(): AiProvider {
  if (env.OPENAI_API_KEY) return new OpenAiCompatible();
  return new DemoAi();
}

export function storeProvider(): StoreProvider {
  return new DemoStore();
}

export function adsProvider(): AdsProvider {
  return new DemoAds();
}
