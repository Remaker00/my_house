"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CHAPTERS, ROOM_ORDER, profile, type ProjectId, type RoomId } from "@/content/story";
import { mountScene, type SceneHandle } from "@/lib/scene";
import Notebook from "./Notebook";

/**
 * Hosts the canvas, his name at the top, the rooms and links at the bottom, and the notebook. The scene runs its own
 * loop outside React; React only tells it where to send him and whether the notebook is open.
 */
export default function House() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spokenRef = useRef<HTMLParagraphElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [open, setOpen] = useState<{ room: RoomId; project: ProjectId | null } | null>(null);

  const choose = useCallback((room: RoomId, project: ProjectId | null) => {
    setOpen({ room, project });
    sceneRef.current?.go(room, project);
    sceneRef.current?.setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(null);
    sceneRef.current?.setOpen(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = mountScene(canvas, window, {
      onChoose: choose,
      onSpeak: (text) => {
        if (spokenRef.current) spokenRef.current.textContent = text;
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [choose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-manipulation select-none"
        role="img"
        aria-label="A house at night, cut open like a dollhouse, every room lit warmly from inside. Nishant, a tiny figure, lives in it: an attic where he began, a library of skills, a workshop of projects, an office, and a front door. Choose a room below and he walks there and tells you about it."
      />
      <p ref={spokenRef} className="sr-only" aria-live="polite" />

      <header className="pointer-events-none fixed top-0 left-0 z-10 px-5 pt-4 sm:px-7 sm:pt-5">
        <h1 className="font-serif text-[22px] leading-tight [text-shadow:0_0_18px_rgba(255,196,107,0.35)] sm:text-[26px]">{profile.name}</h1>
        <p className="text-[13px] text-ink/55 italic">
          {profile.role.toLowerCase()} · {profile.location}
        </p>
      </header>
      <Link
        href="/story"
        className={`word fixed top-5 right-5 z-10 text-[13px] text-ink/55 sm:right-7 ${open ? "min-[900px]:hidden" : ""}`}
      >
        read as text
      </Link>

      <footer
        className={`fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(14px,env(safe-area-inset-bottom))] text-center ${
          open ? "max-[899px]:hidden min-[900px]:right-[min(440px,38vw)]" : ""
        }`}
      >
        <nav aria-label="Rooms" className="flex flex-wrap justify-center text-[15px] sm:text-[16px]">
          {ROOM_ORDER.map((id, i) => (
            <span key={id} className="whitespace-nowrap">
              {i > 0 && <span className="mx-1.5 text-ink/25">·</span>}
              <button
                type="button"
                aria-current={open?.room === id}
                onClick={() => choose(id, null)}
                className={`word ${open?.room === id ? "text-ink" : "text-ink/65"}`}
              >
                {CHAPTERS[id].name}
              </button>
            </span>
          ))}
        </nav>
        <p className="mt-1.5 text-[13px] text-ink/50">
          <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="word">
            résumé
          </a>
          {" · "}
          <a href={profile.links.github} target="_blank" rel="noreferrer" className="word">
            github
          </a>
          {" · "}
          <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="word">
            linkedin
          </a>
          {" · "}
          <a href={`mailto:${profile.email}`} className="word">
            email
          </a>
        </p>
      </footer>

      {open && <Notebook room={open.room} project={open.project} onChoose={choose} onClose={close} />}
    </>
  );
}
