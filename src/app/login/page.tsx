import LoginForm from "@/components/LoginForm";

export default function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}
