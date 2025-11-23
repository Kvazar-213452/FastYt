import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import NotificationProvider from "@/components/notification/NotificationProvider";

import "@/style/global.css";
import "@/style/main.css";

export const metadata: Metadata = {
  title: "FastYt - Скачати YouTube відео у MP3 та MP4",
  description: "Конвертуй YouTube відео у MP3 або MP4 онлайн безкоштовно та швидко з FastYt.",
  keywords: ["скачати youtube", "youtube mp3", "youtube mp4", "конвертер youtube", "FastYt"],
  openGraph: {
    title: "FastYt - YouTube конвертер онлайн",
    description: "Конвертуй YouTube відео у MP3/MP4 безкоштовно. Швидко та просто!",
    url: "https://www.fastyt.site",
    siteName: "FastYt",
    images: [
      {
        url: "https://www.fastyt.site/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "uk_UA",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <NotificationProvider>
            <Header />
            {children}
            <Footer />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
