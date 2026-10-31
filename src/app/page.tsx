import Link from "next/link";
import House from "@/components/House";

export default function Home() {
  return (
    <main className="paper fixed inset-0 overflow-hidden">
      <Link href="/story" className="sr-only focus:not-sr-only focus:fixed focus:top-20 focus:left-5 focus:z-30">
        Skip the house: read the whole story as text
      </Link>
      <House />
    </main>
  );
}
