import type { Metadata } from "next";
import DashboardView from "../components/DashboardView";

export const metadata: Metadata = {
  title: "TweetCheck Preview",
  description: "Video-friendly TweetCheck preview layout with a single-frame live stream composition.",
};

export default function PreviewPage() {
  return <DashboardView variant="preview" />;
}
