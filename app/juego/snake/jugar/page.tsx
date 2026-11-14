"use client";

import dynamic from "next/dynamic";

const SnakeGame = dynamic(() => import("@/components/games/snake"), {
  ssr: false,
});

export default function SnakeJugarPage() {
  return <SnakeGame gameId="snake" />;
}
