import "server-only";
import { cookies } from "next/headers";
import type { ThemePreference } from "@/components/theme/ThemeProvider";

export async function readThemePreference(): Promise<ThemePreference> {
  const v = (await cookies()).get("prooflens.theme")?.value;
  return v === "light" || v === "dark" ? v : "system";
}
