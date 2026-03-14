import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pm-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <div className="min-h-screen bg-pm-bg">
            <NavBar />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
