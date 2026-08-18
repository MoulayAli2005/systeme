"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Wordmark } from "@/components/brand";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      await api("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name")),
          email: String(data.get("email")),
          password: String(data.get("password") || "demo1234xx"),
          organizationName: String(data.get("org") || "My store"),
        }),
      });
      router.push("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create workspace");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col bg-paper">
        <div className="px-6 py-5">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
          <h1 className="font-display text-3xl tracking-tight">Open a workspace.</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Creates a real tenant in Postgres with owner role and default order statuses.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Your name">
              <input name="name" required className={inputClass} defaultValue="Amine Kadiri" />
            </Field>
            <Field label="Work email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Password (8+ chars)">
              <input name="password" type="password" required minLength={8} className={inputClass} />
            </Field>
            <Field label="Company">
              <input name="org" required className={inputClass} defaultValue="Atlas Atelier" />
            </Field>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <PrimaryButton type="submit" className="w-full py-3" disabled={pending}>
              {pending ? "Creating…" : "Create workspace"}
            </PrimaryButton>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-ink">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <p className="font-display text-4xl leading-tight tracking-tight">
          Tenant-isolated COD operations.
        </p>
        <p className="mt-4 max-w-md text-white/60">
          Every company gets its own orders, agents, warehouses and carriers. No spreadsheet, no shared
          inbox with the neighbour.
        </p>
      </div>
    </div>
  );
}
