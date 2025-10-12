import { Metadata } from "next";
import SessionProvider from "./session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Advisor - AI Trading Intelligence",
  description: "AI-powered swing trading advisor that finds the best setups and provides evidence-backed analysis",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
