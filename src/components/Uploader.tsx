"use client";

import { useCallback, useRef, useState } from "react";
import { parseStatement } from "@/lib/parse";
import { SAMPLE_PASSWORD, SAMPLE_URL } from "@/lib/sample";
import { ThemeToggle } from "./ThemeToggle";
import {
  NotABkashStatementError,
  PdfPasswordError,
  type Statement,
} from "@/lib/types";

type Stage =
  | { kind: "idle" }
  | { kind: "password"; wrong: boolean }
  | { kind: "working"; page: number; pages: number }
  | { kind: "error"; message: string };

export function Uploader({ onParsed }: { onParsed: (s: Statement) => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = useCallback(
    async (buffer: ArrayBuffer, pass: string | undefined) => {
      setStage({ kind: "working", page: 0, pages: 0 });
      try {
        const statement = await parseStatement(buffer, pass, {
          onProgress: (p) =>
            setStage({ kind: "working", page: p.page, pages: p.pages }),
        });
        onParsed(statement);
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          setStage({ kind: "password", wrong: err.wrong });
        } else if (err instanceof NotABkashStatementError) {
          setStage({
            kind: "error",
            message:
              "That PDF opened fine, but it has no bKash transaction table. Use the statement PDF that bKash emails you.",
          });
        } else {
          setStage({
            kind: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not read that file.",
          });
        }
      }
    },
    [onParsed],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setStage({ kind: "error", message: "Please choose a PDF file." });
        return;
      }
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      bufferRef.current = buffer;
      await run(buffer, undefined);
    },
    [run],
  );

  const loadSample = useCallback(async () => {
    setFileName("sample-statement.pdf");
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      bufferRef.current = buffer;
      await run(buffer, SAMPLE_PASSWORD);
    } catch {
      setStage({ kind: "error", message: "Could not load the sample statement." });
    }
  }, [run]);

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bufferRef.current) return;
    void run(bufferRef.current, password);
  };

  const reset = () => {
    bufferRef.current = null;
    setFileName(null);
    setPassword("");
    setStage({ kind: "idle" });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-3 rounded-full"
            style={{ background: "var(--brand)" }}
          />
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            bKash statement analyzer
          </span>
        </div>
          <ThemeToggle />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Turn your bKash statement into something you can actually read.
        </h1>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Drop in the password-protected PDF bKash sends you. It is decrypted and
          parsed inside this browser tab — nothing is uploaded, stored, or sent
          anywhere. Close the tab and it is gone.
        </p>
      </div>

      {stage.kind === "password" ? (
        <form
          onSubmit={submitPassword}
          className="rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold">This PDF is password protected</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            For bKash statements the password is your bKash account number — the
            11-digit mobile number, e.g. <code>01XXXXXXXXX</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="numeric"
              autoComplete="off"
              className="tnum min-w-[12rem] flex-1 rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: stage.wrong
                  ? "var(--status-critical)"
                  : "var(--border)",
                background: "var(--page)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--brand)" }}
            >
              Unlock
            </button>
          </div>
          {stage.wrong ? (
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--status-critical)" }}
            >
              That password was rejected. Check the number the statement was
              issued for.
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-xs underline"
            style={{ color: "var(--text-muted)" }}
          >
            Choose a different file
          </button>
        </form>
      ) : stage.kind === "working" ? (
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold">Reading {fileName}</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {stage.pages
              ? `Page ${stage.page} of ${stage.pages}`
              : "Decrypting…"}
          </p>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: stage.pages
                  ? `${Math.round((stage.page / stage.pages) * 100)}%`
                  : "15%",
                background: "var(--series-1)",
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="rounded-xl border-2 border-dashed p-10 text-center transition-colors"
            style={{
              borderColor: dragging ? "var(--brand)" : "var(--border-strong)",
              background: dragging ? "var(--surface-2)" : "var(--surface)",
            }}
          >
            <p className="text-sm font-medium">Drop your statement PDF here</p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              or
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--brand)" }}
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <p
            className="mt-3 text-center text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            No statement handy?{" "}
            <button
              type="button"
              onClick={() => void loadSample()}
              className="font-medium underline"
              style={{ color: "var(--text-primary)" }}
            >
              Try the sample statement
            </button>{" "}
            — synthetic data, password <code>{SAMPLE_PASSWORD}</code>.
          </p>

          {stage.kind === "error" ? (
            <p
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--status-critical)",
                color: "var(--status-critical)",
              }}
            >
              {stage.message}
            </p>
          ) : null}
        </>
      )}

      <ul
        className="mt-8 grid gap-2 text-xs sm:grid-cols-3"
        style={{ color: "var(--text-secondary)" }}
      >
        <li className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <strong className="block" style={{ color: "var(--text-primary)" }}>
            Nothing leaves the tab
          </strong>
          No upload, no server, no storage.
        </li>
        <li className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <strong className="block" style={{ color: "var(--text-primary)" }}>
            Handles the password
          </strong>
          Decrypts the PDF locally with your bKash number.
        </li>
        <li className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <strong className="block" style={{ color: "var(--text-primary)" }}>
            Yours to keep
          </strong>
          Export the parsed rows as CSV or JSON.
        </li>
      </ul>
    </div>
  );
}
