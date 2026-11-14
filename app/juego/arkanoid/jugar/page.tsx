"use client";

import dynamic from "next/dynamic";

const ArkanoidGame = dynamic(() => import("@/components/games/arkanoid"), {
  ssr: false,
});

export default function ArkanoidJugarPage() {
  return <ArkanoidGame gameId="arkanoid" />;
}
