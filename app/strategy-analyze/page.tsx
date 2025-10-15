import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import StrategyAnalyzeClient from "../strategy-analyze-client";

export default async function StrategyAnalyzePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StrategyAnalyzeClient />
    </div>
  );
}
