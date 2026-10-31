import type { Metadata } from "next";
import Link from "next/link";
import { CAREER, CHAPTERS, PROJECTS, ROOM_ORDER, SKILLS, SKILL_GROUPS, profile, type SkillGroup } from "@/content/story";

export const metadata: Metadata = {
  title: `${profile.name} · the story as text`,
  description: profile.summary,
};

/** The whole story on one quiet page: for screen readers, search engines, and anyone in a hurry. */
export default function Story() {
  const job = CAREER.find((c) => c.id === "bytequest")!;
  const early = CAREER.filter((c) => c.id !== "bytequest").reverse();
  const h2 = "mt-14 font-serif text-[26px] leading-tight";
  const label = "text-[13px] tracking-wide text-ink/50 italic";
  return (
    <main className="paper min-h-full px-6 py-12 sm:py-16">
      <article className="mx-auto max-w-[640px] text-[16px] leading-relaxed text-ink/85">
        <p className="text-[14px] text-ink/55">
          <Link href="/" className="word">
            ← back to the house
          </Link>
        </p>
        <h1 className="mt-8 font-serif text-[34px] leading-tight text-ink">{profile.name}</h1>
        <p className={label}>
          {profile.role} · {profile.location} · {profile.availability}
        </p>
        <p className="mt-5 font-serif text-[20px] text-ink">{profile.headline}</p>
        <p className="mt-3">{profile.summary}</p>
        <p className="mt-4 text-[15px]">
          <a href={`mailto:${profile.email}`} className="word">{profile.email}</a> ·{" "}
          <a href={profile.resumeUrl} className="word">résumé</a> ·{" "}
          <a href={profile.links.linkedin} className="word">LinkedIn</a> ·{" "}
          <a href={profile.links.github} className="word">GitHub</a>
        </p>

        <h2 className={h2}>{CHAPTERS.attic.title}</h2>
        {early.map((c) => (
          <section key={c.id} className="mt-5">
            <h3 className="font-serif text-[19px] text-ink">{c.role}</h3>
            <p className={label}>{c.organization} · {c.period}</p>
            <p className="mt-1">{c.note}</p>
          </section>
        ))}

        <h2 className={h2}>{CHAPTERS.library.title}</h2>
        {(Object.keys(SKILL_GROUPS) as SkillGroup[]).map((g) => (
          <p key={g} className="mt-3">
            <span className={label}>{SKILL_GROUPS[g]}: </span>
            {SKILLS.filter((s) => s.group === g).map((s) => s.name).join(", ")}
          </p>
        ))}

        <h2 className={h2}>{CHAPTERS.workshop.title}</h2>
        {PROJECTS.map((p) => (
          <section key={p.id} className="mt-8">
            <h3 className="font-serif text-[21px] text-ink">
              <a href={p.url} className="word">{p.product}</a>
            </h3>
            <p className={label}>{p.category} · {p.period}</p>
            <p className="mt-2">{p.summary}</p>
            {p.metrics.length > 0 && <p className="mt-2">{p.metrics.map((m) => `${m.value} ${m.label}`).join(" · ")}</p>}
            <ul className="mt-2 list-[circle] space-y-1 pl-5">
              {[...p.scope, ...(p.quality ?? [])].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] text-ink/60">{p.stack.join(" · ")}</p>
          </section>
        ))}

        <h2 className={h2}>{CHAPTERS.office.title}</h2>
        <section className="mt-5">
          <h3 className="font-serif text-[19px] text-ink">{job.role}</h3>
          <p className={label}>{job.organization} · {job.period}</p>
          <p className="mt-1">{job.note}</p>
          <p className="mt-2">{job.impact!.map((m) => `${m.value} ${m.label}`).join(" · ")}</p>
        </section>

        <h2 className={h2}>{CHAPTERS.door.title}</h2>
        <p className="mt-3">
          {profile.availability}. Write to <a href={`mailto:${profile.email}`} className="word">{profile.email}</a>.
        </p>
        <p className="mt-16 text-[13px] text-ink/45 italic">
          {ROOM_ORDER.length} rooms, one house. <Link href="/" className="word">Walk through it →</Link>
        </p>
      </article>
    </main>
  );
}
