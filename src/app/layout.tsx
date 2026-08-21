import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAProvider } from "@/components/pwa-provider";
import { LoadingBar } from "@/components/loading-bar";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Toaster } from "@/components/ui/toast";
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#d4a843",
};

const SITE_URL = "https://lipapoint.co.ke";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LipaPoint — #1 POS System for Kenyan Businesses",
    template: "%s | LipaPoint POS Kenya",
  },
  description:
    "Kenya's leading Point of Sale system. M-Pesa integration, inventory management, real-time analytics, staff tracking & multi-location support. Free 14-day trial.",
  keywords: [
    "POS system Kenya",
    "point of sale Kenya",
    "M-Pesa POS",
    "restaurant POS Kenya",
    "retail POS system",
    "bar POS system",
    "supermarket POS",
    "pharmacy POS Kenya",
    "inventory management Kenya",
    "sales tracking software Kenya",
    "KRA compliant POS",
    "best POS system Nairobi",
    "affordable POS Kenya",
    "cloud POS Kenya",
    "POS software Kenya",
    "till system Kenya",
    "EPOS Kenya",
    "mfumo wa mauzo",
  ],
  authors: [{ name: "LipaPoint", url: SITE_URL }],
  creator: "LipaPoint",
  publisher: "LipaPoint",
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: SITE_URL,
    siteName: "LipaPoint",
    title: "LipaPoint — #1 POS System for Kenyan Businesses",
    description:
      "All-in-one POS system with M-Pesa, inventory, analytics & staff management. Built for restaurants, bars, retail, supermarkets & pharmacies in Kenya.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LipaPoint POS System - Run Your Business Smarter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LipaPoint — #1 POS System for Kenyan Businesses",
    description:
      "All-in-one POS with M-Pesa, inventory, analytics & staff management. Free trial.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LipaPoint",
  },
  verification: {
    google: "ADD_YOUR_GOOGLE_VERIFICATION_CODE",
  },
  category: "business",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="geo.region" content="KE" />
        <meta name="geo.placename" content="Nairobi" />
        <meta name="geo.position" content="-1.2921;36.8219" />
        <meta name="ICBM" content="-1.2921, 36.8219" />
      </head>
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <ThemeProvider>
          <PWAProvider>
            <LoadingBar />
            {children}
            <OfflineIndicator />
          </PWAProvider>
        </ThemeProvider>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(r=>{r.update();setInterval(()=>r.update(),60*60*1000)})})}`,
          }}
        />
      </body>
    </html>
  );
}
