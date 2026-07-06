"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

interface KeywordSearchProps {
  name: string;
  defaultValue: string;
  keywordLocale: string;
  label: string;
  placeholder: string;
}

/**
 * Search input with prefix autocomplete over the keywords table. Suggestions
 * come from /api/keywords/suggest, scoped to the selected market locale.
 */
export function KeywordSearch({
  name,
  defaultValue,
  keywordLocale,
  label,
  placeholder,
}: KeywordSearchProps) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onChange(next: string) {
    setValue(next);
    clearTimeout(debounceRef.current);
    const query = next.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/keywords/suggest?q=${encodeURIComponent(query)}&locale=${keywordLocale}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: string[] };
        setSuggestions(data.suggestions);
        setOpen(data.suggestions.length > 0);
      } catch {
        // autocomplete is best-effort
      }
    }, 150);
  }

  function choose(term: string) {
    // Flush the state update into the DOM before submitting, otherwise the
    // form serializes the previous input value.
    flushSync(() => {
      setValue(term);
      setOpen(false);
    });
    wrapperRef.current?.closest("form")?.requestSubmit();
  }

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <label className="sr-only" htmlFor="keyword-search">
        {label}
      </label>
      <input
        id="keyword-search"
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        placeholder={placeholder}
        autoComplete="off"
        className="border-ink/20 focus:border-violet focus:ring-violet/30 h-11 w-full rounded-full border px-5 text-sm transition outline-none focus:ring-2"
      />
      {open && (
        <ul
          data-testid="suggestions"
          className="border-ink/10 absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border bg-white py-1 shadow-lg"
        >
          {suggestions.map((term) => (
            <li key={term}>
              <button
                type="button"
                onClick={() => choose(term)}
                className="hover:bg-violet/5 w-full px-5 py-2 text-left text-sm"
              >
                {term}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
