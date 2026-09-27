import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/marketing/Wordmark";
import { VerifyEmailForm } from "./VerifyEmailForm";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const sent = sp.sent === "1";
  const cooldown = typeof sp.cooldown === "string" ? Number.parseInt(sp.cooldown, 10) || 0 : 0;
  return (
    <main id="main" className="flex min-h-[100dvh] flex-col px-4 py-6 sm:px-6 lg:px-10">
      <Link href="/" className="inline-flex w-fit text-ink" aria-label="ProofLens home">
        <Wordmark />
      </Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <VerifyEmailForm email={email} sent={sent} cooldown={cooldown} />
      </div>
    </main>
  );
}
