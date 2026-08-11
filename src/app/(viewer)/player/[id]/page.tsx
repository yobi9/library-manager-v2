//src\app\(viewer)\player\[id]\page.tsx
"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Spinner } from "@/shared/components/ui/spinner";

const PlayerClient = dynamic(() => import("@/features/viewer/pages/player-page"), {
  ssr: false,
  loading: () => <div className="flex min-h-screen items-center justify-center bg-black"><Spinner /></div>,
});

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  return <PlayerClient id={id} />;
}
