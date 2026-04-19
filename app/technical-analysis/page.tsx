import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Navbar from "../components/navbar";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TechnicalAnalysisClient />
      </main>
    </div>
  );
}
