import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import StrategyAnalyzeClient from "../strategy-analyze-client";
import Navbar from "../components/navbar";

export default async function StrategyAnalyzePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <StrategyAnalyzeClient />
    </div>
  );
}
