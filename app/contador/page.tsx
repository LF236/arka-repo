'use client';

import { useState } from 'react';

const SPRITE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

export default function ContadorPage() {
  const [count, setCount] = useState(1);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl">Contador Pokémon</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={count}
        src={`${SPRITE}/${count}.png`}
        alt={`Pokémon #${count}`}
        width={256}
        height={256}
      />
      <p className="text-2xl">#{count}</p>
      <button className="btn" onClick={() => setCount((c) => c + 1)}>
        +1
      </button>
    </main>
  );
}
