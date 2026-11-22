'use client';

// src/components/core/TextAnswerInput.tsx: the typed-answer fallback offered on every practice
// screen (design 05 §1 "non-speech input path"; plan H2). Pronunciation scoring is unavailable
// in text mode, so callers should label that explicitly rather than hide the option.
import { useState, type FormEvent } from 'react';
import { t, type StringKey, type UiLangMode } from '../../lib/ui/strings.ts';

interface TextAnswerInputProps {
  labelKey?: StringKey;
  submitKey?: StringKey;
  mode?: UiLangMode;
  onSubmit: (value: string) => void;
  autoFocus?: boolean;
}

export default function TextAnswerInput({
  labelKey = 'drillsTypeAnswer',
  submitKey = 'drillsSubmit',
  mode = 'fr',
  onSubmit,
  autoFocus = false,
}: TextAnswerInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '') return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="text-answer-input">{t(labelKey, mode)}</label>
      <input
        id="text-answer-input"
        type="text"
        lang="en"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        style={{ display: 'block', width: '100%', minHeight: 'var(--touch-min)', marginBlock: 'var(--space-2)' }}
      />
      <button type="submit" className="btn">
        {t(submitKey, mode)}
      </button>
    </form>
  );
}
