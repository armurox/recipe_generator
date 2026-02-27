import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-5xl">🔍</div>
      <h1 className="mb-2 text-xl font-bold text-gray-900">Page not found</h1>
      <p className="mb-6 text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Button asChild className="rounded-xl bg-green-700 px-6 hover:bg-green-700/90">
        <Link href="/dashboard">Go home</Link>
      </Button>
    </div>
  );
}
