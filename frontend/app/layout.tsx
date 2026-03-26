import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TweetCheck | Real-time sentiment firehose",
  description:
    "A live recruiter-facing dashboard for a distributed sentiment analysis system built with Go, Kafka, Redis, FastAPI, PyTorch, and Next.js.",
  applicationName: "TweetCheck",
  keywords: ["TweetCheck", "sentiment analysis", "Kafka", "Redis", "FastAPI", "PyTorch", "Next.js", "dashboard"],
  openGraph: {
    title: "TweetCheck | Real-time sentiment firehose",
    description:
      "A live recruiter-facing dashboard for a distributed sentiment analysis system built with Go, Kafka, Redis, FastAPI, PyTorch, and Next.js.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "TweetCheck | Real-time sentiment firehose",
    description:
      "A live recruiter-facing dashboard for a distributed sentiment analysis system built with Go, Kafka, Redis, FastAPI, PyTorch, and Next.js.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
