"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export function Uploader({ onParsed }: { onParsed: (s: Statement) => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
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

  // A rejected password stays in the box, selected, so retyping replaces it.
  useEffect(() => {
    if (stage.kind === "password" && stage.wrong) passwordRef.current?.select();
  }, [stage]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isPdf(file)) {
        setStage({
          kind: "error",
          message: `“${file.name}” is not a PDF. Choose the statement PDF bKash emailed you.`,
        });
        return;
      }
      setFileName(file.name);
      setPassword("");
      const buffer = await file.arrayBuffer();
      bufferRef.current = buffer;
      await run(buffer, undefined);
    },
    [run],
  );

  const loadSample = useCallback(async () => {
    setFileName("sample-statement.pdf");
    // Show progress straight away; the fetch itself can take a moment.
    setStage({ kind: "working", page: 0, pages: 0 });
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
    if (!bufferRef.current || !password) return;
    void run(bufferRef.current, password);
  };

  const reset = () => {
    bufferRef.current = null;
    setFileName(null);
    setPassword("");
    setShowPassword(false);
    setStage({ kind: "idle" });
  };

  const pickFile = () => inputRef.current?.click();

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

      <Steps current={stage.kind === "password" ? 2 : stage.kind === "working" ? 3 : 1} />

      {stage.kind === "password" ? (
        <form
          onSubmit={submitPassword}
          className="rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold">
            Unlock{" "}
            <span className="break-all font-normal" style={{ color: "var(--text-secondary)" }}>
              {fileName}
            </span>
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            The password is the bKash account number the statement was issued
            for — the 11-digit mobile number, e.g. <code>01XXXXXXXXX</code>. It
            never leaves this tab.
          </p>
          <label
            htmlFor="statement-password"
            className="mt-4 block text-xs font-medium"
          >
            Statement password
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <input
                id="statement-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="01XXXXXXXXX"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={stage.wrong}
                aria-describedby={stage.wrong ? "password-error" : undefined}
                className="tnum w-full rounded-md border py-2 pl-3 pr-16 text-sm"
                style={{
                  borderColor: stage.wrong
                    ? "var(--status-critical)"
                    : "var(--border)",
                  background: "var(--page)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-controls="statement-password"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <button
              type="submit"
              disabled={!password}
              className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--brand)", color: "var(--on-brand)" }}
            >
              Unlock
            </button>
          </div>
          {stage.wrong ? (
            <p
              id="password-error"
              role="alert"
              className="mt-2 text-xs"
              style={{ color: "var(--status-critical)" }}
            >
              That password was rejected. Check the number the statement was
              issued for — it may differ from the one you use now.
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
          role="status"
          aria-live="polite"
        >
          <h2 className="text-sm font-semibold">
            Reading <span className="break-all">{fileName}</span>
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {stage.pages
              ? `Parsing page ${stage.page} of ${stage.pages}…`
              : "Opening and decrypting the PDF…"}
          </p>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-2)" }}
            role="progressbar"
            aria-label="Reading statement"
            aria-valuemin={0}
            aria-valuemax={stage.pages || undefined}
            aria-valuenow={stage.pages ? stage.page : undefined}
          >
            {stage.pages ? (
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${Math.round((stage.page / stage.pages) * 100)}%`,
                  background: "var(--series-1)",
                }}
              />
            ) : (
              <div
                className="progress-indeterminate h-full w-2/5 rounded-full"
                style={{ background: "var(--series-1)" }}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            onClick={(e) => {
              // The button below opens the picker itself.
              if ((e.target as HTMLElement).closest("button")) return;
              pickFile();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragging(true);
            }}
            onDragLeave={(e) => {
              // Moving over a child fires dragleave on the parent; ignore it.
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors"
            style={{
              borderColor: dragging ? "var(--brand)" : "var(--border-strong)",
              background: dragging ? "var(--surface-2)" : "var(--surface)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto mb-3 size-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: dragging ? "var(--brand)" : "var(--text-muted)" }}
              aria-hidden
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M12 18v-6M9.5 14.5 12 12l2.5 2.5" />
            </svg>
            <p className="text-sm font-medium">
              {dragging ? "Drop to open it" : "Drop your statement PDF here"}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              or
            </p>
            <button
              type="button"
              onClick={pickFile}
              className="mt-3 rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "var(--brand)", color: "var(--on-brand)" }}
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {stage.kind === "error" ? (
            <div
              role="alert"
              className="mt-3 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--status-critical)",
                color: "var(--status-critical)",
              }}
            >
              <span>{stage.message}</span>
              <button
                type="button"
                onClick={() => setStage({ kind: "idle" })}
                aria-label="Dismiss"
                className="shrink-0 leading-none"
              >
                ✕
              </button>
            </div>
          ) : null}

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
            — synthetic data, unlocks automatically.
          </p>
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

const STEPS = ["Choose the PDF", "Enter the password", "Read the statement"];

/** Where the user is in the three-step flow, so the password ask is expected. */
function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li
            key={label}
            className="flex items-center gap-1.5"
            aria-current={state === "current" ? "step" : undefined}
            style={{
              color:
                state === "todo" ? "var(--text-muted)" : "var(--text-primary)",
              fontWeight: state === "current" ? 600 : 400,
            }}
          >
            <span
              aria-hidden
              className="grid size-4 place-items-center rounded-full text-[10px]"
              style={{
                background:
                  state === "todo" ? "var(--surface-2)" : "var(--brand)",
                color: state === "todo" ? "var(--text-muted)" : "var(--on-brand)",
              }}
            >
              {state === "done" ? "✓" : n}
            </span>
            {label}
            {n < STEPS.length ? (
              <span aria-hidden style={{ color: "var(--axis)" }}>
                —
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
