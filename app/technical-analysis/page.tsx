import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppShell from "../components/app-shell";
import TechnicalAnalysisClient from "./technical-analysis-client";

export const metadata = {
  title: "Technical Analysis | Trader Journey",
  description: "Professional-grade technical analysis with advanced indicators, probability-based predictions, and AI-powered insights",
};

export default async function TechnicalAnalysisPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell session={session}>
      <TechnicalAnalysisClient />
    </AppShell>
  );
}
