"use client";

import { Suspense, use } from "react";
import { Thread } from "@/features/message/components/Thread";

export default function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Thread id={id} />
    </Suspense>
  );
}
