import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { UsersRound } from "lucide-react";
import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata(
  "Team",
  "The people building and supporting TuRnMaRk.",
  "/team",
);

type TeamProfile = {
  id: string;
  full_name: string;
  role_title: string;
  bio: string | null;
  avatar_url: string | null;
};

async function getPublishedTeamProfiles(): Promise<TeamProfile[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return [];
    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from("team_profiles")
      .select("id,full_name,role_title,bio,avatar_url")
      .eq("is_published", true)
      .order("display_order", { ascending: true });
    if (error || !data) return [];
    return data as TeamProfile[];
  } catch {
    return [];
  }
}

export default async function PublicTeamPage() {
  const profiles = await getPublishedTeamProfiles();

  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="Team" path="/team" />
        <p className={styles.eyebrow}>OUR TEAM</p>
        <h1>
          People behind
          <br />
          <em>TuRnMaRk.</em>
        </h1>
        <p className={styles.subpageLead}>
          Verified team profiles published directly from our organization directory.
        </p>

        {profiles.length > 0 ? (
          <section className={styles.steps} aria-label="Team members">
            {profiles.map((member) => (
              <article key={member.id} className={styles.step}>
                <div className="mb-4 flex items-center gap-3">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={member.full_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff0e8] text-[#ff6b2b]">
                      <UsersRound size={20} aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <h3 className="!m-0 !text-lg">{member.full_name}</h3>
                    <p className="text-xs font-semibold text-[#ff6b2b]">{member.role_title}</p>
                  </div>
                </div>
                {member.bio ? <p>{member.bio}</p> : null}
              </article>
            ))}
          </section>
        ) : (
          <section className="panel max-w-2xl p-8">
            <h2 className="text-xl font-bold text-[#111318]">Team directory</h2>
            <p className="mt-2 text-sm text-neutral-600">
              No public team profiles have been published yet. Want to reach our engineering or onboarding team?
            </p>
            <Link href="/contact" className="mt-5 inline-flex items-center gap-2 font-bold text-[#ff6b2b] hover:underline">
              Contact TuRnMaRk →
            </Link>
          </section>
        )}
      </main>
    </MarketingFrame>
  );
}
