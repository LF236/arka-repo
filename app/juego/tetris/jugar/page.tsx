"use client";

import dynamic from "next/dynamic";

const TetrisGame = dynamic(() => import("@/components/games/tetris"), {
  ssr: false,
});

export default function TetrisJugarPage() {
  return <TetrisGame gameId="tetris" />;
}
