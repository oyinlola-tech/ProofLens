import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSessionToken } from "@/lib/auth/session";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/app") ? sp.next : "/app";
  if (await readSessionToken()) redirect(next);
  return <RegisterForm />;
}
