import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "M3U Content Manager - Advanced M3U/M3U8 File Processing",
  description:
    "Advanced M3U/M3U8 file processing and content management application. Organize, search, filter, and download channels with ease.",
  keywords: [
    "M3U",
    "M3U8",
    "Content Manager",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "IPTV",
    "Media Streaming",
  ],
  authors: [{ name: "barisariburnu", url: "https://github.com/barisariburnu" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "M3U Content Manager",
    description:
      "Advanced M3U/M3U8 file processing and content management application",
    url: "https://github.com/barisariburnu/m3u-content-manager",
    siteName: "M3U Content Manager",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "M3U Content Manager",
    description:
      "Advanced M3U/M3U8 file processing and content management application",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest" async></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
