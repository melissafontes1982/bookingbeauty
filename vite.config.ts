import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Build para o Vercel: o plugin "nitro" gera a pasta .vercel/output
// (páginas + funções de servidor) que o Vercel entende automaticamente.
export default defineConfig({
  server: { port: 8080 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    tailwindcss(),
    nitro({ preset: "vercel" }),
  ],
});
