import { AuthGateway } from "@/components/auth/AuthGateway";

export default function AuthPage() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <AuthGateway />
      </div>
    </main>
  );
}