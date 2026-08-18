export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Nexora API</h1>
      <p className="mt-3 text-sm text-zinc-600">
        REST under <code>/api/v1</code>. Cookie <code>nexora_session</code> or Bearer token. Spec:{" "}
        <a className="underline" href="/api/openapi.json">
          /api/openapi.json
        </a>
        . Health:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
        .
      </p>
      <pre className="mt-6 overflow-auto rounded-2xl bg-ink p-4 text-xs text-mint">
        {`curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H 'content-type: application/json' \\
  -d '{"email":"amine@atlasatelier.ma","password":"demo1234"}'`}
      </pre>
    </div>
  );
}
