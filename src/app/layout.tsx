import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const FALLBACK_URL = "https://teamflow.vercel.app";

const APP_URL = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL).toString();
  } catch {
    return FALLBACK_URL;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "TeamFlow — Gestão de equipes, projetos e metas",
    template: "%s | TeamFlow",
  },
  description:
    "Plataforma para organizar colaboradores, departamentos, equipes, projetos, tarefas e metas em um só lugar.",
  keywords: [
    "gestão de equipes",
    "gestão de projetos",
    "tarefas",
    "metas",
    "colaboradores",
  ],
  openGraph: {
    type: "website",
    siteName: "TeamFlow",
    title: "TeamFlow — Gestão de equipes, projetos e metas",
    description:
      "Plataforma para organizar colaboradores, departamentos, equipes, projetos, tarefas e metas em um só lugar.",
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "TeamFlow — Gestão de equipes, projetos e metas",
    description:
      "Plataforma para organizar colaboradores, departamentos, equipes, projetos, tarefas e metas em um só lugar.",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}