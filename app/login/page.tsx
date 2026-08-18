"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { Wordmark } from "@/components/brand";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { setSession } from "@/lib/store";

function enter(name: string, email: string) {
  setSession({ name, email, role: "owner" });
}

export default function LoginPage() {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    enter(
      String(data.get("name") || "Amine Kadiri"),
      String(data.get("email") || "amine@atlasatelier.ma"),
    );
    router.push("/app/dashboard");
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
          Sign in to your workspace, or jump into the Atlas Atelier demo.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue="amine@atlasatelier.ma"
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              defaultValue="demo"
              className={inputClass}
            />
          </Field>
          <input type="hidden" name="name" value="Amine Kadiri" />
          <PrimaryButton type="submit" className="w-full py-3">
            Sign in
          </PrimaryButton>
        </form>
        <button
          type="button"
          onClick={() => {
            enter("Amine Kadiri", "amine@atlasatelier.ma");
            router.push("/app/dashboard");
          }}
          className="mt-3 w-full rounded-full border border-sand bg-white py-3 text-sm font-semibold"
        >
          Open demo workspace
        </button>
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
