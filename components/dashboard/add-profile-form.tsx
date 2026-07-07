"use client";

import { useActionState } from "react";
import type { TrackProfileState } from "@/app/[locale]/app/dashboard/actions";

interface AddProfileFormProps {
  action: (
    prev: TrackProfileState,
    formData: FormData,
  ) => Promise<TrackProfileState>;
  placeholder: string;
  cta: string;
  messages: {
    invalid: string;
    notFound: string;
    limit: string;
  };
}

export function AddProfileForm({
  action,
  placeholder,
  cta,
  messages,
}: AddProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
  });

  return (
    <form action={formAction} className="w-full max-w-md">
      <div className="flex gap-2">
        <input
          name="handle"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          data-testid="add-profile-input"
          className="border-ink/20 focus:border-violet focus:ring-violet/30 h-12 flex-1 rounded-full border px-5 text-sm transition outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          data-testid="add-profile-submit"
          className="bg-violet hover:bg-violet/90 h-12 rounded-full px-6 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {cta}
        </button>
      </div>
      {state.status !== "idle" && (
        <p
          role="alert"
          data-testid="add-profile-error"
          className="mt-2 text-sm text-red-600"
        >
          {messages[state.status]}
        </p>
      )}
    </form>
  );
}
