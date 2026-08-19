import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { log } = await import("./server/log");
  log.error("Unhandled server error", err, {
    path: request.path,
    method: request.method,
    requestId: request.headers?.["x-request-id"],
    routerKind: context.routerKind,
    routePath: context.routePath,
    renderSource: context.renderSource,
  });
};
