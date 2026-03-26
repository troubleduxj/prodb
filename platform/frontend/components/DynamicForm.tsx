import React from 'react';
import { PluginField } from '../types';

interface DynamicFormProps {
  fields: PluginField[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ fields, values, onChange }) => {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {field.type === 'select' ? (
             <select
               value={values[field.name] || field.defaultValue || ''}
               onChange={(e) => onChange(field.name, e.target.value)}
               className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
             >
                {!values[field.name] && !field.defaultValue && <option value="" disabled>Select an option</option>}
                {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
             </select>
          ) : field.type === 'textarea' ? (
            <textarea
              value={values[field.name] !== undefined ? values[field.name] : (field.defaultValue || '')}
              onChange={(e) => onChange(field.name, e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow font-mono text-sm"
              placeholder={field.defaultValue ? String(field.defaultValue) : ''}
              rows={4}
            />
          ) : (
            <input
              type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
              value={values[field.name] !== undefined ? values[field.name] : (field.defaultValue || '')}
              onChange={(e) => onChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder={field.defaultValue ? String(field.defaultValue) : ''}
            />
          )}
          {field.description && (
             <p className="text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      ))}
    </div>
  );
};