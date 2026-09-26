"use client";

import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Uploader } from "@/components/Uploader";
import type { Statement } from "@/lib/types";

export default function Home() {
  const [statement, setStatement] = useState<Statement | null>(null);

  if (!statement) return <Uploader onParsed={setStatement} />;

  return (
    <Dashboard statement={statement} onReset={() => setStatement(null)} />
  );
}
