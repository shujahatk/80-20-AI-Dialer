import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md mx-auto flex flex-col items-center gap-4">
        <AlertCircle className="w-16 h-16 text-primary" />
        <h1 className="text-3xl font-bold text-on-surface">404 - Page Not Found</h1>
        <p className="text-sm text-on-surface-variant">
          The page or resource you requested does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
