import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "BusinessOS — Project Management",
  description: "AI-first project management. Files as memory, AI as intelligence, UI as a window.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <div className="min-h-screen bg-pm-bg">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
