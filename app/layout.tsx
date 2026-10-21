import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/shared/providers/query-provider";
import { Toaster } from "@/shared/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Rent Collection",
    template: "%s | Rent Collection",
  },
  description: "Rent collection system for property managers",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          {children}
          <Toaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
