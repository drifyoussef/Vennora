"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primitives de formulaire.
 *
 * Hauteur 11 (44 px) sur tous les champs : c'est la cible tactile minimale
 * confortable, et le technicien saisit sur téléphone aussi souvent que
 * l'administrateur au bureau. On ne fait pas deux jeux de formulaires.
 */

export function FormSection({
  title,
  hint,
  children,
  columns = 2,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <fieldset>
      <legend className="font-heading text-base font-semibold">{title}</legend>
      {hint && (
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{hint}</p>
      )}
      <div
        className={cn(
          "mt-4 grid gap-4",
          columns === 2 && "sm:grid-cols-2",
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Wrapper({
  name,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  defaultValue,
  error,
  hint,
  required,
  className,
  ...rest
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "defaultValue" | "name" | "id">) {
  // Un champ passé en contrôlé (`value` + `onChange`, comme les horaires du
  // formulaire d'intervention) ne doit pas recevoir en plus un `defaultValue` :
  // React refuse les deux à la fois.
  const controlled = rest.value !== undefined;

  return (
    <Wrapper
      name={name}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <Input
        id={name}
        name={name}
        {...(controlled ? {} : { defaultValue: defaultValue ?? "" })}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="mt-2 h-11"
        {...rest}
      />
    </Wrapper>
  );
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  error,
  hint,
  rows = 4,
  placeholder,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Wrapper
      name={name}
      label={label}
      error={error}
      hint={hint}
      className={className}
    >
      <Textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="mt-2"
      />
    </Wrapper>
  );
}

/**
 * Sélecteur natif plutôt que le composant Radix.
 *
 * Sur téléphone, `<select>` ouvre la roue système : plus rapide à manipuler
 * d'une main qu'une liste déroulante personnalisée, et accessible sans
 * effort. Les listes riches (client → site → équipement) utilisent en
 * revanche un composant dédié.
 */
export function SelectField({
  name,
  label,
  options,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  className,
  disabled,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** Non contrôlé. Utiliser `value`/`onChange` pour un sélecteur dépendant. */
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const controlled = value !== undefined;
  return (
    <Wrapper
      name={name}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <select
        id={name}
        name={name}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(
          "mt-2 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}
