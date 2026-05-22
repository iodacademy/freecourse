"use client";

import type { ProfileField } from "@/lib/types";

interface DynamicFormProps {
  fields: ProfileField[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

/**
 * Komponen Dynamic Form Builder
 * Membuat form secara otomatis berdasarkan konfigurasi field dari admin.
 * Mendukung tipe: text, number, email, tel, date, select, textarea
 */
export default function DynamicForm({
  fields,
  values,
  errors,
  onChange,
}: DynamicFormProps) {
  return (
    <>
      {fields.map((field) => (
        <div className="form-group" key={field.name}>
          <label className="form-label" htmlFor={`field-${field.name}`}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>

          {field.type === "select" ? (
            <select
              id={`field-${field.name}`}
              className={`form-select ${errors[field.name] ? "error" : ""}`}
              value={values[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
            >
              <option value="">Pilih {field.label}</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              id={`field-${field.name}`}
              className={`form-textarea ${errors[field.name] ? "error" : ""}`}
              placeholder={field.placeholder}
              value={values[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          ) : (
            <input
              id={`field-${field.name}`}
              className={`form-input ${errors[field.name] ? "error" : ""}`}
              type={field.type}
              placeholder={field.placeholder}
              value={values[field.name] || ""}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          )}

          {errors[field.name] && (
            <span className="form-error">{errors[field.name]}</span>
          )}
        </div>
      ))}
    </>
  );
}
