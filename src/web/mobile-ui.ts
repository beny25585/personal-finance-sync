import { join } from "node:path";

export async function serveMobileUi(
  path: string,
  root: string,
  headers: Record<string, string>,
): Promise<Response | undefined> {
  if (!path.startsWith("/mobile/")) return undefined;
  const asset = path.slice("/mobile/".length);
  // Only serve the entry and Vite-generated assets from the configured build.
  if (asset && !/^assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2?|png|svg|ico)$/.test(asset)) {
    return new Response("Not found", { status: 404 });
  }
  const file = Bun.file(join(root, asset || "index.html"));
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file, {
    headers: { ...headers, "Content-Type": file.type, "Cache-Control": "private, no-cache" },
  });
}
