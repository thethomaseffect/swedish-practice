import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function basePath(): string {
  const raw = process.env.VITE_BASE_PATH?.trim();
  if (!raw || raw === "/") return "/";
  if (raw === "./" || raw === ".") return "./";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  plugins: [react()],
  base: basePath(),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
