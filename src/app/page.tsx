import Dashboard from "@/components/Dashboard";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  if (!(await isAuthenticated())) redirect("/login");
  return <Dashboard />;
}
