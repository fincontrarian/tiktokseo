"use client";

import { useActionState } from "react";
import type { LeadFormState } from "@/app/[locale]/audit/actions";

interface LeadFormProps {
  action: (prev: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  handle?: string;
  intent: "unlock" | "notify";
  placeholder: string;
  cta: string;
  successMessage: string;
  invalidMessage: string;
}

export function LeadForm({
  action,
  handle,
  intent,
  placeholder,
  cta,
  successMessage,
  invalidMessage,
}: LeadFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
  });

  if (state.status === "success") {
    return (
      <p
        data-testid="lead-success"
        className="bg-lime text-ink rounded-xl px-4 py-3 text-sm font-medium"
      >
        {successMessage}
      </p>
    );
  }

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="handle" value={handle ?? ""} />
      <input type="hidden" name="intent" value={intent} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder={placeholder}
          className="border-ink/20 focus:border-violet focus:ring-violet/30 h-12 flex-1 rounded-full border bg-white px-5 text-sm transition outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-ink hover:bg-ink/85 h-12 rounded-full px-6 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {cta}
        </button>
      </div>
      {state.status === "invalid" && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {invalidMessage}
        </p>
      )}
    </form>
  );
}
