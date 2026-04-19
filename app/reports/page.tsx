import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/app-shell";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell session={session}>
      <ReportsClient />
    </AppShell>
  );
}
