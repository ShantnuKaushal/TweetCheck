import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const headlineFont = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
  display: "swap",
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
      <body className={`${bodyFont.variable} ${headlineFont.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
