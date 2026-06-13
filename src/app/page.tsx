import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          Split expenses fairly
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Track shared costs, handle messy imports, and settle up with minimal transactions.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
        <div className="mt-16 grid gap-6 text-left sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-6">
            <h3 className="mb-2 font-semibold">Who pays whom</h3>
            <p className="text-sm text-gray-600">
              One number per person. Minimal settlement suggestions so everyone knows exactly what to pay.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6">
            <h3 className="mb-2 font-semibold">Full breakdown</h3>
            <p className="text-sm text-gray-600">
              Every balance traces back to individual expenses — no magic numbers.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6">
            <h3 className="mb-2 font-semibold">Smart import</h3>
            <p className="text-sm text-gray-600">
              Import messy CSVs with anomaly detection, currency conversion, and approval workflow.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
