"use client";

import { useEffect, useRef, useState } from "react";
import {
  CAREER,
  CHAPTERS,
  PROJECTS,
  ROOM_ORDER,
  SKILLS,
  SKILL_GROUPS,
  profile,
  type ProjectId,
  type RoomId,
  type SkillGroup,
} from "@/content/story";

/**
 * The notebook beside the house: the plain facts of the room he's in. A column on the right on wide screens, a sheet
 * over the bottom half on narrow ones (sizes in step with CHROME in scene.ts). Words, not boxes.
 */
export default function Notebook({
  room,
  project,
  onChoose,
  onClose,
}: {
  room: RoomId;
  project: ProjectId | null;
  onChoose: (room: RoomId, project: ProjectId | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const i = ROOM_ORDER.indexOf(room);
  const prev = ROOM_ORDER[i - 1];
  const next = ROOM_ORDER[i + 1];

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [room, project]);

  return (
    <aside
      ref={ref}
      aria-label={CHAPTERS[room].title}
      className="notebook fixed inset-x-0 bottom-0 z-20 h-[50dvh] overflow-y-auto border-t border-ink/15 bg-paper/92 px-6 shadow-[0_-20px_60px_rgba(0,0,0,0.45)] pt-5 pb-8 backdrop-blur-[2px] min-[900px]:inset-x-auto min-[900px]:top-0 min-[900px]:right-0 min-[900px]:h-full min-[900px]:w-[min(440px,38vw)] min-[900px]:border-t-0 min-[900px]:border-l min-[900px]:px-9 min-[900px]:pt-16"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] tracking-wide text-ink/50 italic">
          {i + 1} / {ROOM_ORDER.length} · the {CHAPTERS[room].name}
        </p>
        <button type="button" onClick={onClose} className="word text-[13px] text-ink/55">
          close
        </button>
      </div>
      <h2 className="mt-2 font-serif text-[28px] leading-tight">{CHAPTERS[room].title}</h2>

      <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-ink/85">
        {room === "attic" && <Beginnings />}
        {room === "library" && <Skills />}
        {room === "workshop" && <Workshop project={project} onChoose={onChoose} />}
        {room === "office" && <Office />}
        {room === "door" && <Hello />}
      </div>

      <nav aria-label="Chapters" className="mt-10 flex justify-between gap-4 text-[14px] text-ink/60">
        {prev ? (
          <button type="button" className="word" onClick={() => onChoose(prev, null)}>
            ← {CHAPTERS[prev].name}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" className="word" onClick={() => onChoose(next, null)}>
            {CHAPTERS[next].name} →
          </button>
        )}
      </nav>
    </aside>
  );
}

function Beginnings() {
  const early = CAREER.filter((c) => c.id !== "bytequest").reverse();
  return (
    <>
      <p>
        I didn&apos;t start in software. I trained as an electrical engineer, then made a deliberate switch: a year of
        intensive, project-based full-stack training, and I haven&apos;t looked back.
      </p>
      {early.map((c) => (
        <Entry key={c.id} title={c.role} sub={`${c.organization} · ${c.period}`}>
          {c.note}
        </Entry>
      ))}
    </>
  );
}

function Skills() {
  const groups = Object.keys(SKILL_GROUPS) as SkillGroup[];
  return (
    <>
      <p>The ones in amber are the books I use every day.</p>
      {groups.map((g) => (
        <div key={g}>
          <h3 className="text-[13px] tracking-wide text-ink/50 italic">{SKILL_GROUPS[g]}</h3>
          <p className="mt-1">
            {SKILLS.filter((s) => s.group === g).map((s, i, all) => (
              <span key={s.name}>
                <span className={s.core ? "font-semibold text-glow" : undefined}>{s.name}</span>
                {i < all.length - 1 && <span className="text-ink/35"> · </span>}
              </span>
            ))}
          </p>
        </div>
      ))}
    </>
  );
}

function Workshop({ project, onChoose }: { project: ProjectId | null; onChoose: (room: RoomId, project: ProjectId | null) => void }) {
  return (
    <>
      <p>{project ? "Pick up another one on the bench, or from this list." : "Things I've shipped. Pick one up from the bench, or from this list."}</p>
      <ul className="space-y-1">
        {PROJECTS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-current={p.id === project}
              onClick={() => onChoose("workshop", p.id)}
              className={`word text-left ${p.id === project ? "text-ink" : "text-ink/70"}`}
            >
              {p.id === project ? "▸ " : ""}
              {p.product}
              <span className="text-ink/45 italic"> · {p.category}</span>
            </button>
          </li>
        ))}
      </ul>
      {project && <ProjectNotes id={project} />}
    </>
  );
}

function ProjectNotes({ id }: { id: ProjectId }) {
  const p = PROJECTS.find((q) => q.id === id)!;
  return (
    <article className="border-t border-ink/15 pt-5">
      <h3 className="font-serif text-[22px] leading-tight">{p.product}</h3>
      <p className="text-[13px] text-ink/50 italic">
        {p.category} · {p.period}
      </p>
      <p className="mt-3">{p.summary}</p>
      {p.metrics.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {p.metrics.map((m) => (
            <li key={m.label}>
              <span className="font-serif text-[18px] text-glow">{m.value}</span> <span className="text-ink/60">{m.label}</span>
            </li>
          ))}
        </ul>
      )}
      <h4 className="mt-4 text-[13px] tracking-wide text-ink/50 italic">What I built</h4>
      <ul className="mt-1 list-[circle] space-y-1 pl-5">
        {p.scope.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {p.quality && (
        <>
          <h4 className="mt-4 text-[13px] tracking-wide text-ink/50 italic">How it was verified</h4>
          <ul className="mt-1 list-[circle] space-y-1 pl-5">
            {p.quality.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-[14px] text-ink/60">{p.stack.join(" · ")}</p>
      <p className="mt-3">
        <a href={p.url} target="_blank" rel="noreferrer" className="word">
          {p.urlLabel} ↗
        </a>
      </p>
    </article>
  );
}

function Office() {
  const job = CAREER.find((c) => c.id === "bytequest")!;
  return (
    <>
      <Entry title={job.role} sub={`${job.organization} · ${job.period}`}>
        {job.note}
      </Entry>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
        {job.impact!.map((m) => (
          <li key={m.label}>
            <span className="block font-serif text-[22px] leading-none text-glow">{m.value}</span>
            <span className="text-[13px] text-ink/60">{m.label}</span>
          </li>
        ))}
      </ul>
      <p>
        The projects from these years are upstairs in the workshop:{" "}
        {PROJECTS.map((p) => p.product).join(", ")}
        .
      </p>
    </>
  );
}

function Hello() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the mailto link is right beside it.
    }
  };
  return (
    <>
      <p>
        {profile.availability}. {profile.experience} of shipping React and Next.js in production, based in {profile.location}.
      </p>
      <p className="font-serif text-[19px] break-all">
        <a href={`mailto:${profile.email}`} className="word">
          {profile.email}
        </a>
      </p>
      <p className="text-[14px] text-ink/60">
        <button type="button" onClick={copy} className="word">
          {copied ? "copied" : "copy email"}
        </button>
      </p>
      <ul className="space-y-1">
        <li>
          <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="word">
            résumé (pdf) ↗
          </a>
        </li>
        <li>
          <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="word">
            LinkedIn ↗
          </a>
        </li>
        <li>
          <a href={profile.links.github} target="_blank" rel="noreferrer" className="word">
            GitHub ↗
          </a>
        </li>
      </ul>
    </>
  );
}

function Entry({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-[19px] leading-snug text-ink">{title}</h3>
      <p className="text-[13px] text-ink/50 italic">{sub}</p>
      <p className="mt-1.5">{children}</p>
    </div>
  );
}
