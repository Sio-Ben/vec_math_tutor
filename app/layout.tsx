import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_TC, Syne } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "向量教學助手",
  description: "澳門高中數學平面向量 · 診斷問卷與 Socratic 練習",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTc.variable} ${syne.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col font-sans">{children}</body>
    </html>
  );
}
