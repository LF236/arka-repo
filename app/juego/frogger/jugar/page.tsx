"use client";

import dynamic from "next/dynamic";

const FroggerGame = dynamic(() => import("@/components/games/frogger"), {
  ssr: false,
});

export default function FroggerJugarPage() {
  return <FroggerGame gameId="frogger" />;
}
