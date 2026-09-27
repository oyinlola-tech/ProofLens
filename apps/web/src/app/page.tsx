import { MarketingShell, isAuthed } from "@/components/marketing/Shell";
import { Hero } from "@/components/marketing/Hero";
import { Bento, ClosingCta, Principles, SeeItWork, VerdictTeaser } from "@/components/marketing/HomeSections";

export default async function Home() {
  const authed = await isAuthed();
  return (
    <MarketingShell>
      <Hero authed={authed} />
      <Principles />
      <Bento />
      <SeeItWork />
      <VerdictTeaser />
      <ClosingCta authed={authed} />
    </MarketingShell>
  );
}
