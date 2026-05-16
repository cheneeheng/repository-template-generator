"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const items = trpc.items.list.useQuery();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{{PROJECT_NAME}}</h1>
      <h2>Items</h2>
      {items.isLoading && <p>Loading…</p>}
      {items.data?.length === 0 && <p>No items yet.</p>}
      <ul>
        {items.data?.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  );
}
