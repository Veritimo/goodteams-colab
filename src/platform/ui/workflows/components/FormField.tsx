/**
 * FormField Component
 *
 * Reusable form field component with label, input, and help text.
 * Supports text, textarea, select, number, and checkbox input types.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4.3
 */

import React from "react";

/**
 * Supported form field types
 */
export type FormFieldType = "text" | "textarea" | "select" | "number" | "checkbox";

/**
 * Option for select fields
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Props for the FormField component
 */
export interface FormFieldProps {
  /** Unique identifier for the field */
  id: string;
  /** Display label */
  label: string;
  /** Input type */
  type: FormFieldType;
  /** Current value */
  value: string | number | boolean;
  /** Change handler */
  onChange: (value: string | number | boolean) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional help text displayed below the field */
  helpText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Options for select fields */
  options?: SelectOption[];
  /** Number of rows for textarea */
  rows?: number;
  /** Minimum value for number fields */
  min?: number;
  /** Maximum value for number fields */
  max?: number;
  /** Step for number fields */
  step?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable form field component
 */
export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  helpText,
  required = false,
  disabled = false,
  error,
  options = [],
  rows = 4,
  min,
  max,
  step,
  className = "",
}: FormFieldProps): React.ReactElement {
  const hasError = Boolean(error);

  const baseInputStyles = `
    w-full bg-slate-700 border-2 rounded-xl px-4 py-3 text-sm font-medium
    focus:bg-slate-800 text-slate-100 transition-all outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    ${hasError ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-blue-500"}
  `;

  const renderInput = (): React.ReactElement => {
    switch (type) {
      case "textarea":
        return (
          <textarea
            id={id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={rows}
            className={`${baseInputStyles} resize-none`}
            aria-describedby={helpText ? `${id}-help` : undefined}
            aria-invalid={hasError}
          />
        );

      case "select":
        return (
          <select
            id={id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            className={baseInputStyles}
            aria-describedby={helpText ? `${id}-help` : undefined}
            aria-invalid={hasError}
          >
            <option value="" disabled>
              Select...
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <input
            type="number"
            id={id}
            value={value as number}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={baseInputStyles}
            aria-describedby={helpText ? `${id}-help` : undefined}
            aria-invalid={hasError}
          />
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={id}
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              required={required}
              disabled={disabled}
              className={`
                w-5 h-5 rounded border-2 border-slate-600 bg-slate-700
                checked:bg-blue-500 checked:border-blue-500
                focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                ${hasError ? "border-red-500" : ""}
              `}
              aria-describedby={helpText ? `${id}-help` : undefined}
              aria-invalid={hasError}
            />
            <label htmlFor={id} className="text-sm font-medium text-slate-200 cursor-pointer">
              {label}
              {required && <span className="text-red-400 ml-1">*</span>}
            </label>
          </div>
        );

      case "text":
      default:
        return (
          <input
            type="text"
            id={id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={baseInputStyles}
            aria-describedby={helpText ? `${id}-help` : undefined}
            aria-invalid={hasError}
          />
        );
    }
  };

  // Checkbox has inline label, others have standard label above
  if (type === "checkbox") {
    return (
      <div className={`space-y-2 ${className}`}>
        {renderInput()}
        {helpText && (
          <p id={`${id}-help`} className="text-xs text-slate-400 ml-8">
            {helpText}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 ml-8" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs font-bold text-slate-400 uppercase tracking-wider"
      >
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {renderInput()}
      {helpText && (
        <p id={`${id}-help`} className="text-xs text-slate-400">
          {helpText}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
