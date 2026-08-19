import { ChevronDown } from "lucide-react";
import { Children, cloneElement, isValidElement } from "react";
import type { ComponentProps, ReactNode } from "react";

// The ONE definition of form controls. Replaces the ad-hoc `fieldClass` string
// copy-pasted across ~15 forms (auth-forms, edit-store-form, coupon-manager,
// address-manager, ...). <Field> wraps any control with label/hint/error;
// <Input>, <Textarea>, <Select> are the styled native controls. Spacing uses
// logical properties (pe-*, end-*) so everything is RTL-safe.

// Exported so existing forms can adopt by deleting their local constant first,
// then migrate to the components at their own pace.
export const fieldClass =
  // border-strong, not border: a control's border is its only boundary cue and
  // must clear 3:1 against the surrounding surface (WCAG 1.4.11). Decorative
  // dividers keep the quieter --border.
  "h-11 w-full rounded-xl border border-border-strong bg-surface px-4 text-sm text-foreground " +
  "outline-none transition-[border-color,box-shadow] duration-150 " +
  "placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60";

const errorClass = "border-danger focus:border-danger focus:ring-danger/15";

/** Label + control + hint/error wrapper. Pass the control as children. */
export function Field({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  className = "",
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  /** When set, replaces the hint and turns the message red. */
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  // The asterisk is aria-hidden, so the requirement must reach AT through the
  // control itself: mirror `required`/`aria-required` onto the child control.
  // Cloning the single element child works for <Input>/<Select>/<Textarea> and
  // raw controls alike (their prop spread forwards to the native element);
  // anything more complex keeps its own props untouched.
  const content =
    required && Children.count(children) === 1 && isValidElement(children)
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          required: true,
          "aria-required": true,
          ...(children.props as Record<string, unknown>),
        })
      : children;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold">
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      {content}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  error = false,
  className = "",
  ...props
}: { error?: boolean } & Omit<ComponentProps<"input">, "ref">) {
  return (
    <input
      className={`${fieldClass} ${error ? errorClass : ""} ${className}`}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

export function Textarea({
  error = false,
  className = "",
  ...props
}: { error?: boolean } & Omit<ComponentProps<"textarea">, "ref">) {
  return (
    <textarea
      className={`${fieldClass} h-auto min-h-24 resize-y py-3 ${error ? errorClass : ""} ${className}`}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

/** Styled native select with a chevron affordance (logical `end`, RTL-safe). */
export function Select({
  error = false,
  className = "",
  children,
  ...props
}: { error?: boolean } & Omit<ComponentProps<"select">, "ref">) {
  return (
    <span className={`relative block ${className}`}>
      <select
        className={`${fieldClass} appearance-none pe-10 ${error ? errorClass : ""}`}
        aria-invalid={error || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </span>
  );
}
