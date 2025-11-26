import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

// Input component with error styling
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`
        block w-full rounded-md border px-3 py-2 text-sm
        shadow-sm transition-colors
        placeholder:text-slate-400
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
        ${
          hasError
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-200'
        }
        ${className}
      `}
    />
  );
}

// Select component with error styling
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError, className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`
        block w-full rounded-md border px-3 py-2 text-sm
        shadow-sm transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
        ${
          hasError
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-200'
        }
        ${className}
      `}
    >
      {children}
    </select>
  );
}

// Textarea component with error styling
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({ hasError, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`
        block w-full rounded-md border px-3 py-2 text-sm
        shadow-sm transition-colors
        placeholder:text-slate-400
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
        resize-y min-h-[80px]
        ${
          hasError
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-200'
        }
        ${className}
      `}
    />
  );
}

// Checkbox group component
interface CheckboxGroupProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  name: string;
  hasError?: boolean;
}

export function CheckboxGroup({
  options,
  selected,
  onChange,
  name,
  hasError,
}: CheckboxGroupProps) {
  const handleChange = (value: string, checked: boolean) => {
    if (checked) {
      onChange([...selected, value]);
    } else {
      onChange(selected.filter((v) => v !== value));
    }
  };

  return (
    <div
      className={`
        flex flex-wrap gap-3 p-3 rounded-md border
        ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}
      `}
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            name={name}
            value={opt.value}
            checked={selected.includes(opt.value)}
            onChange={(e) => handleChange(opt.value, e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// Form validation summary component
interface ValidationSummaryProps {
  errors: Record<string, string | undefined>;
  title?: string;
}

export function ValidationSummary({ errors, title = 'Please fix the following errors:' }: ValidationSummaryProps) {
  const errorMessages = Object.entries(errors)
    .filter(([, error]) => error !== undefined)
    .map(([field, error]) => ({ field, error: error! }));

  if (errorMessages.length === 0) return null;

  return (
    <div className="rounded-md bg-red-50 p-4 border border-red-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
            {errorMessages.map(({ field, error }) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
