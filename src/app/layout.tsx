import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neighbourhood OS — Municipal Intelligence Platform",
  description:
    "AI-powered municipal social cohesion platform. Identify socially isolated neighbourhoods and engineer hyper-personalised connection opportunities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", inter.variable, jetbrainsMono.variable)}
    >
      <body className="h-full overflow-hidden antialiased font-sans bg-canvas text-foreground">
        {children}
      </body>
    </html>
  );
}
