import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/app-shell";
import ReportDetailClient from "./report-detail-client";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <AppShell session={session}>
      <ReportDetailClient reportId={id} />
    </AppShell>
  );
}
