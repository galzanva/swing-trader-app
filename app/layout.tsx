import { Metadata } from "next";
import SessionProvider from "./session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trader Journey",
  description: "Trading journal, analytics, technical analysis, and tools for your trading workflow",
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
