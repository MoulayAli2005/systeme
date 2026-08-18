"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { Wordmark } from "@/components/brand";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { setSession } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSession({
      name: String(data.get("name") || "Amine Kadiri"),
      email: String(data.get("email") || "amine@atlasatelier.ma"),
      role: "owner",
    });
    router.push("/app/dashboard");
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
            This demo loads Atlas Atelier — a Moroccan fashion store running COD
            through WhatsApp, Ozon Express and Shopify.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Your name">
              <input name="name" defaultValue="Amine Kadiri" className={inputClass} />
            </Field>
            <Field label="Work email">
              <input
                name="email"
                type="email"
                defaultValue="amine@atlasatelier.ma"
                className={inputClass}
              />
            </Field>
            <Field label="Store name">
              <input defaultValue="Atlas Atelier" className={inputClass} />
            </Field>
            <PrimaryButton type="submit" className="w-full py-3">
              Launch demo workspace
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
          Confirm on WhatsApp.
          <br />
          Ship without the spreadsheet.
        </p>
        <p className="mt-4 max-w-md text-white/60">
          47 orders in the last 24 hours. 78% confirmed. 12 ready to dispatch.
          This is what a Tuesday looks like inside Nexora.
        </p>
      </div>
    </div>
  );
}
