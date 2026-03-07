import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogActions, Button } from '@radix-ui/react-dialog';
import { PrimitiveSchema, ElicitationSchema, ElicitationRequest, ElicitationResult, ElicitationAction } from '../types/elicitation';

// Add React and Radix UI type definitions
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
}

interface ElicitationDialogProps {
  open: boolean;
  onClose: () => void;
  onElicitationComplete: (result: ElicitationResult) => void;
  schema: ElicitationSchema;
  toolName: string;
}

const ElicitationDialog: React.FC<ElicitationDialogProps> = ({
  open,
  onClose,
  onElicitationComplete,
  schema,
  toolName,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form data against schema
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (schema.required) {
      for (const requiredField of schema.required) {
        if (formData[requiredField] === undefined || formData[requiredField] === '') {
          newErrors[requiredField] = 'This field is required';
        }
      }
    }

    // Validate each field based on its schema
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const value = formData[fieldName];

      if (fieldSchema.type === 'string') {
        if (fieldSchema.minLength && value && value.length < fieldSchema.minLength) {
          newErrors[fieldName] = `Minimum length is ${fieldSchema.minLength}`;
        }
        if (fieldSchema.maxLength && value && value.length > fieldSchema.maxLength) {
          newErrors[fieldName] = `Maximum length is ${fieldSchema.maxLength}`;
        }
        if (fieldSchema.format === 'email' && value && !isValidEmail(value)) {
          newErrors[fieldName] = 'Invalid email format';
        }
      } else if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
        if (fieldSchema.minimum && value && value < fieldSchema.minimum) {
          newErrors[fieldName] = `Minimum value is ${fieldSchema.minimum}`;
        }
        if (fieldSchema.maximum && value && value > fieldSchema.maximum) {
          newErrors[fieldName] = `Maximum value is ${fieldSchema.maximum}`;
        }
      } else if (fieldSchema.type === 'string' && fieldSchema.enum) {
        if (value && !fieldSchema.enum.includes(value)) {
          newErrors[fieldName] = 'Invalid option selected';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear error for this field
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const request: ElicitationRequest = {
        tool: toolName,
        arguments: formData,
      };

      // Simulate API call (in real implementation, this would call the MCP server)
      const result: ElicitationResult = await simulateElicitationCall(request);
      onElicitationComplete(result);
    } catch (error) {
      console.error('Elicitation failed:', error);
      // Show error to user (in real implementation)
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const simulateElicitationCall = async (request: ElicitationRequest): Promise<ElicitationResult> => {
    // Simulate a successful call
    return {
      content: [
        {
          type: 'text',
          text: `Successfully processed ${toolName} with arguments: ${JSON.stringify(request.arguments)}`,
        },
      ],
      is_error: false,
    };
  };

  // Render form field based on schema type
  const renderField = (fieldName: string, fieldSchema: PrimitiveSchema) => {
    const value = formData[fieldName] || '';

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.enum) {
          return (
            <div key={fieldName}>
              <label>{fieldSchema.title || fieldName}</label>
              <select
                value={value}
                onChange={(e) => handleChange(fieldName, e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Select...</option>
                {fieldSchema.enum.map((option) => (
                  <option key={option} value={option}>
                    {fieldSchema.enumNames ? fieldSchema.enumNames[fieldSchema.enum.indexOf(option)] : option}
                  </option>
                ))}
              </select>
              {errors[fieldName] && <div style={{ color: 'red' }}>{errors[fieldName]}</div>}
            </div>
          );
        } else {
          return (
            <div key={fieldName}>
              <label>{fieldSchema.title || fieldName}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(fieldName, e.target.value)}
                placeholder={fieldSchema.description}
                disabled={isSubmitting}
              />
              {errors[fieldName] && <div style={{ color: 'red' }}>{errors[fieldName]}</div>}
            </div>
          );
        }

      case 'number':
      case 'integer':
        return (
          <div key={fieldName}>
            <label>{fieldSchema.title || fieldName}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(fieldName, e.target.value ? Number(e.target.value) : '')}
              placeholder={fieldSchema.description}
              disabled={isSubmitting}
            />
            {errors[fieldName] && <div style={{ color: 'red' }}>{errors[fieldName]}</div>}
          </div>
        );

      case 'boolean':
        return (
          <div key={fieldName}>
            <label>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleChange(fieldName, e.target.checked)}
                disabled={isSubmitting}
              />
              {fieldSchema.title || fieldName}
            </label>
            {errors[fieldName] && <div style={{ color: 'red' }}>{errors[fieldName]}</div>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle>Elicitation for {toolName}</DialogTitle>
      <DialogContent>
        {schema.description && <p>{schema.description}</p>}
        {Object.entries(schema.properties).map(([fieldName, fieldSchema]) => (
          renderField(fieldName, fieldSchema)
        ))}
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ElicitationDialog;
