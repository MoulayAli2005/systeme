import { env } from "../env";
import { NotConnectedError } from "./types";
import type { EmailProvider, MessagingProvider, PhoneProvider, ShippingProvider } from "./types";

export class TwilioSms implements MessagingProvider {
  channel = "sms" as const;
  name = "twilio-sms";
  configured = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);

  async sendMessage(input: { to: string; text: string }) {
    if (!this.configured) throw new NotConnectedError("Twilio SMS");
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: input.to,
          From: env.TWILIO_FROM_NUMBER!,
          Body: input.text,
        }),
      },
    );
    if (!res.ok) throw new Error("Twilio SMS send failed");
    const data = (await res.json()) as { sid: string; status: string };
    return { id: data.sid, status: data.status };
  }
}

export class TwilioWhatsApp implements MessagingProvider {
  channel = "whatsapp" as const;
  name = "twilio-whatsapp";
  configured = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);

  async sendMessage(input: { to: string; text: string }) {
    if (!this.configured) throw new NotConnectedError("Twilio WhatsApp");
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const to = input.to.startsWith("whatsapp:") ? input.to : `whatsapp:${input.to}`;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: env.TWILIO_WHATSAPP_FROM!,
          Body: input.text,
        }),
      },
    );
    if (!res.ok) throw new Error("Twilio WhatsApp send failed");
    const data = (await res.json()) as { sid: string; status: string };
    return { id: data.sid, status: data.status };
  }
}

export class TwilioVoice implements PhoneProvider {
  name = "twilio-voice";
  configured = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);

  async makeCall(input: { to: string; from?: string; orderId?: string }) {
    if (!this.configured) throw new NotConnectedError("Twilio Voice");
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const twiml = `<Response><Say language="fr-FR">Nexora confirmation. Commande ${input.orderId ?? ""}.</Say></Response>`;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: input.to,
          From: input.from ?? env.TWILIO_FROM_NUMBER!,
          Twiml: twiml,
        }),
      },
    );
    if (!res.ok) throw new Error("Twilio call failed");
    const data = (await res.json()) as { sid: string; status: string };
    return { id: data.sid, status: data.status };
  }

  async getCallStatus(id: string) {
    if (!this.configured) throw new NotConnectedError("Twilio Voice");
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${id}.json`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) throw new Error("Twilio status failed");
    const data = (await res.json()) as { status: string; duration?: string };
    return { status: data.status, durationSec: data.duration ? Number(data.duration) : undefined };
  }
}

export class GenericHttpCarrier implements ShippingProvider {
  name = "generic-http-carrier";
  configured = Boolean(env.CARRIER_API_URL);

  async createShipment(input: {
    orderId: string;
    city: string;
    address: string;
    phone: string;
    codAmount: number;
  }) {
    if (!this.configured) throw new NotConnectedError("Generic carrier");
    const res = await fetch(`${env.CARRIER_API_URL}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.CARRIER_API_KEY ? { Authorization: `Bearer ${env.CARRIER_API_KEY}` } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Carrier API createShipment failed");
    const data = (await res.json()) as { awb: string; trackingUrl?: string };
    return { awb: data.awb, trackingUrl: data.trackingUrl, raw: data };
  }

  async cancelShipment(awb: string) {
    if (!this.configured) throw new NotConnectedError("Generic carrier");
    await fetch(`${env.CARRIER_API_URL}/shipments/${encodeURIComponent(awb)}/cancel`, {
      method: "POST",
      headers: env.CARRIER_API_KEY ? { Authorization: `Bearer ${env.CARRIER_API_KEY}` } : {},
    });
  }

  async trackShipment(awb: string) {
    if (!this.configured) throw new NotConnectedError("Generic carrier");
    const res = await fetch(`${env.CARRIER_API_URL}/shipments/${encodeURIComponent(awb)}`, {
      headers: env.CARRIER_API_KEY ? { Authorization: `Bearer ${env.CARRIER_API_KEY}` } : {},
    });
    if (!res.ok) throw new Error("Carrier API track failed");
    const data = (await res.json()) as { status: string; detail?: string };
    return { status: data.status, detail: data.detail };
  }

  async printLabel(awb: string) {
    if (!this.configured) throw new NotConnectedError("Generic carrier");
    return { message: "Request a label from the carrier API", url: `${env.CARRIER_API_URL}/labels/${awb}` };
  }
}

export class SendGridEmail implements EmailProvider {
  name = "sendgrid";
  configured = Boolean(env.SENDGRID_API_KEY);

  async send(input: { to: string; subject: string; text: string }) {
    if (!this.configured) throw new NotConnectedError("SendGrid");
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: env.SMTP_FROM?.match(/<([^>]+)>/)?.[1] ?? "noreply@localhost" },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.text }],
      }),
    });
    if (!res.ok) throw new Error("SendGrid send failed");
    return { id: res.headers.get("x-message-id") ?? `sg_${Date.now()}` };
  }
}
