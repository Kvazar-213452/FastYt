import type { Metadata } from "next";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import NotificationProvider from "@/components/notification/NotificationProvider";
import VideoDownloader from "./downloaders/youtube/page";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "@/style/main.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://www.fastyt.site'),
  title: {
    default: "FastYt - Free YouTube to MP3 and MP4 Converter Online",
    template: "%s | FastYt"
  },
  description: "Download YouTube videos as MP3 or MP4 files for free. FastYt is the fastest and easiest way to convert YouTube videos to MP3 audio or MP4 video format. No registration required, unlimited downloads, high quality output.",
  keywords: [
    "youtube downloader",
    "youtube to mp3",
    "youtube to mp4",
    "youtube converter",
    "download youtube videos",
    "youtube mp3 converter",
    "youtube video downloader",
    "free youtube downloader",
    "online video downloader",
    "convert youtube to mp3",
    "youtube audio downloader",
    "youtube hd downloader",
    "fastyt",
    "fast youtube downloader",
    "youtube download online",
    "youtube music downloader",
    "youtube to audio",
    "video to mp3 converter",
    "youtube playlist downloader"
  ],
  authors: [{ name: "FastYt" }],
  creator: "FastYt",
  publisher: "FastYt",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.fastyt.site",
    siteName: "FastYt",
    title: "FastYt - Free YouTube to MP3 and MP4 Converter",
    description: "Download and convert YouTube videos to MP3 or MP4 format for free. Fast, easy, and no registration required. High-quality downloads in seconds.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FastYt - YouTube Video Downloader",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FastYt - Free YouTube to MP3 and MP4 Converter",
    description: "Download YouTube videos as MP3 or MP4 for free. Fast, simple, and unlimited downloads.",
    images: ["/og-image.png"],
    creator: "@fastyt",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "https://www.fastyt.site",
  },
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },
  category: "Technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "FastYt",
    "description": "Free online YouTube to MP3 and MP4 converter. Download YouTube videos quickly and easily.",
    "url": "https://www.fastyt.site",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "YouTube to MP3 conversion",
      "YouTube to MP4 download",
      "High quality video downloads",
      "Fast conversion speed",
      "No registration required",
      "Unlimited downloads",
      "Multiple format support"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "15420",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <GoogleAnalytics></GoogleAnalytics>
      </head>
      <body>
         <GoogleAnalytics></GoogleAnalytics>
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-YFH9C29CL2"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-YFH9C29CL2');
            `,
          }}
        />
        
        {/* JSON-LD Schema */}
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        
        <ThemeProvider>
          <NotificationProvider>
            <Header />
            <VideoDownloader />
            <Footer />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}