"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Wordmark } from "@/components/brand";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [totp, setTotp] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(e.currentTarget);
    try {
      const result = await api<{ user: { isPlatformAdmin?: boolean } }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(data.get("email")),
          password: String(data.get("password")),
          totp: String(data.get("totp") || "") || undefined,
        }),
      });
      router.push(result.user.isPlatformAdmin ? "/platform" : "/app/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "TOTP_REQUIRED") {
        setTotp(true);
        setError("Enter your authenticator code.");
      } else {
        setError(err instanceof ApiClientError ? err.message : "Sign in failed");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="px-6 py-5">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="font-display text-3xl tracking-tight">Welcome back.</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Demo owner: amine@atlasatelier.ma / demo1234
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Email">
            <input name="email" type="email" defaultValue="amine@atlasatelier.ma" className={inputClass} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" defaultValue="demo1234" className={inputClass} />
          </Field>
          {totp ? (
            <Field label="Authenticator code">
              <input name="totp" className={inputClass} autoFocus />
            </Field>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <PrimaryButton type="submit" className="w-full py-3" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-ink">
            Create a workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
