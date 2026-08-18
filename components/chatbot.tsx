"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Minimize2, Send, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { cn } from "@/lib/format";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

const SITE_PROMPTS = [
  "C'est quoi Nexora ?",
  "Comment me connecter ?",
  "Quels transporteurs ?",
];

const OPS_PROMPTS = [
  "Combien de livraisons cette semaine ?",
  "Quelle ville livre le moins bien ?",
  "Où en est le profit ?",
];

function isOpsPath(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/platform");
}

export function Chatbot() {
  const pathname = usePathname();
  const ops = isOpsPath(pathname);
  const storageKey = ops ? "nexora.chat.ops" : "nexora.chat.site";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw) as Message[]);
      else setMessages([]);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-24)));
    } catch {
      // Private mode can refuse sessionStorage; the chat still works in-memory.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const path = ops ? "/api/v1/ai/ask" : "/api/v1/chat";
      const body = ops
        ? { question, history: next.slice(0, -1).slice(-6) }
        : { messages: next.slice(-8) };
      const res = await api<{ answer: string; provider: string; configured: boolean }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessages((current) => [...current, { role: "assistant", content: res.answer }]);
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 401
          ? "Connectez-vous pour que je lise vos commandes — ou restez ici, je peux parler produit."
          : err instanceof Error
            ? err.message
            : "Le chatbot est indisponible.";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  const prompts = ops ? OPS_PROMPTS : SITE_PROMPTS;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-4 md:p-5">
      {open ? (
        <section
          className="pointer-events-auto flex h-[min(560px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-sand bg-white shadow-[0_24px_80px_rgba(7,20,16,0.25)]"
          role="dialog"
          aria-label="Noor chatbot"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-ink">
              <Bot size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-none">Noor</div>
              <div className="mt-1 text-[11px] text-white/55">
                {ops ? "Copilote ops · vos chiffres" : "FR · AR · EN · Darija"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Minimize chat"
            >
              <Minimize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setOpen(false);
              }}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-paper/60 px-3 py-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-white p-3 text-sm text-zinc-600 shadow-sm">
                {ops
                  ? "Je lis les 7 derniers jours de votre workspace. Demandez un taux de livraison, une ville, un n° NX-… ou un AWB."
                  : "Je suis Noor. Je peux vous expliquer Nexora, les tarifs, les transporteurs, ou comment ouvrir la démo."}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void send(prompt)}
                      className="rounded-full border border-sand bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-5",
                    message.role === "user"
                      ? "rounded-br-sm bg-ink text-white"
                      : "rounded-bl-sm bg-white text-ink shadow-sm",
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs text-zinc-400 shadow-sm">
                  Noor écrit…
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-sand bg-white p-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ops ? "NX-11546, une ville, le profit…" : "Posez une question…"}
              className="flex-1 rounded-full bg-paper px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-ink disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(7,20,16,0.35)] hover:bg-forest"
          aria-label="Open Noor chatbot"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint text-ink">
            <Bot size={15} />
          </span>
          Ask Noor
        </button>
      )}
    </div>
  );
}
