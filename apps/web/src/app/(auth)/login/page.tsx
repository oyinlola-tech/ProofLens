import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSessionToken } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/app") ? sp.next : "/app";
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;
  if (await readSessionToken()) redirect(next);
  return <LoginForm next={next} reason={reason} />;
}
