"use client";

import { useActionState } from "react";
import type { HandleFormState } from "@/app/[locale]/audit/actions";

interface HandleFormProps {
  action: (
    prev: HandleFormState,
    formData: FormData,
  ) => Promise<HandleFormState>;
  inputLabel: string;
  placeholder: string;
  cta: string;
  invalidMessage: string;
}

export function HandleForm({
  action,
  inputLabel,
  placeholder,
  cta,
  invalidMessage,
}: HandleFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="w-full max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="handle">
          {inputLabel}
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          className="border-ink/20 focus:border-violet focus:ring-violet/30 h-14 flex-1 rounded-full border px-6 text-lg transition outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-violet hover:bg-violet/90 h-14 rounded-full px-8 text-base font-semibold text-white transition disabled:opacity-60"
        >
          {cta}
        </button>
      </div>
      {state.error === "invalid" && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {invalidMessage}
        </p>
      )}
    </form>
  );
}
