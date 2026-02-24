import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useElicitationDialog } from '@/hooks/useElicitationDialog'
import { useServiceHub } from '@/hooks/useServiceHub'
import { MessageSquareQuote, Check, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { RenderMarkdown } from '@/containers/RenderMarkdown'
import { cn } from '@/lib/utils'
import type {
  ElicitationAction,
  ElicitationSchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  EnumSchema,
  MultiSelectEnumSchema,
  ObjectSchema,
  EnumOption,
} from '@/types/events'

// ============================================================================
// Enum Detection and Extraction Utilities
// ============================================================================

/**
 * Extract enum options from any schema format
 * Handles: oneOf, enum, anyOf (Pydantic/FastMCP format)
 */
function extractEnumOptions(schema: Record<string, unknown>): EnumOption[] {
  // Check oneOf format
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    return schema.oneOf as EnumOption[]
  }
  
  // Check enum format
  if (schema.enum && Array.isArray(schema.enum)) {
    return (schema.enum as (string | number | boolean)[]).map((value) => ({
      const: value,
      title: String(value),
    }))
  }
  
  // Check anyOf format (used by Pydantic/FastMCP for Literal types)
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    return (schema.anyOf as Array<{ const: string | number | boolean; title?: string }>).map((opt) => ({
      const: opt.const,
      title: opt.title || String(opt.const),
    }))
  }
  
  return []
}

/**
 * Check if a schema represents an enum with limited valid options
 * This is more permissive to handle various formats from different MCP servers
 */
function hasEnumOptions(schema: Record<string, unknown>): boolean {
  return extractEnumOptions(schema).length > 0
}

/**
 * Validate that a value is within the allowed enum options
 * Handles type coercion for string/number/boolean comparisons
 */
function validateEnumValue(value: unknown, allowedOptions: EnumOption[]): ValidationResult {
  if (!allowedOptions.length) {
    return { isValid: true } // No restrictions if no options defined
  }
  
  // Check if the value matches any option (with type coercion for form inputs)
  const isAllowed = allowedOptions.some((opt) => {
    // Direct match
    if (opt.const === value) return true
    
    // Handle string-to-number comparison (form inputs return strings)
    if (typeof value === 'string') {
      // Try matching as number
      if (typeof opt.const === 'number') {
        const numValue = parseFloat(value)
        if (!isNaN(numValue) && opt.const === numValue) return true
      }
      // Try matching as boolean
      if (typeof opt.const === 'boolean') {
        if (value === 'true' && opt.const === true) return true
        if (value === 'false' && opt.const === false) return true
      }
    }
    
    return false
  })
  
  if (!isAllowed) {
    const allowedValues = allowedOptions.map((o) => String(o.const)).join(', ')
    return { 
      isValid: false, 
      error: `Invalid value. Allowed options: ${allowedValues}` 
    }
  }
  
  return { isValid: true }
}

/**
 * Type guard to check if schema is an object schema with properties
 */
function isObjectSchema(schema: ElicitationSchema): schema is ObjectSchema {
  return schema.type === 'object' && 'properties' in schema
}

/**
 * Type guard to check if schema is a string schema (without enum options)
 */
function isStringSchema(schema: ElicitationSchema): schema is StringSchema {
  // Exclude schemas that have enum options in any format
  return schema.type === 'string' && !hasEnumOptions(schema as unknown as Record<string, unknown>)
}

/**
 * Type guard to check if schema is a number schema (without enum options)
 */
function isNumberSchema(schema: ElicitationSchema): schema is NumberSchema {
  // Exclude schemas that have enum options in any format
  return (schema.type === 'number' || schema.type === 'integer') && !hasEnumOptions(schema as unknown as Record<string, unknown>)
}

/**
 * Type guard to check if schema is a boolean schema
 */
function isBooleanSchema(schema: ElicitationSchema): schema is BooleanSchema {
  return schema.type === 'boolean'
}

/**
 * Type guard to check if schema is a single-select enum (oneOf or enum)
 * Also handles schemas without explicit type but with enum/oneOf (FastMCP scalar list format)
 */
function isEnumSchema(schema: ElicitationSchema): schema is EnumSchema {
  // Check for explicit type with oneOf/enum
  if (
    (schema.type === 'string' || schema.type === 'number' || schema.type === 'integer' || schema.type === 'boolean') &&
    ('oneOf' in schema || 'enum' in schema)
  ) {
    return true
  }
  
  // Also handle schemas without type but with enum (FastMCP scalar elicitation with list)
  // These come from response_type=["option1", "option2", ...] in FastMCP
  const schemaAsRecord = schema as unknown as Record<string, unknown>
  if ('enum' in schemaAsRecord || 'oneOf' in schemaAsRecord) {
    return true
  }
  
  return false
}

/**
 * Type guard to check if schema is a multi-select enum (array with anyOf items)
 */
function isMultiSelectEnumSchema(schema: ElicitationSchema): schema is MultiSelectEnumSchema {
  return schema.type === 'array' && 'items' in schema && 'anyOf' in (schema as MultiSelectEnumSchema).items
}

/**
 * Get enum options from an enum schema
 * Handles both proper EnumSchema and schemas without explicit type
 */
function getEnumOptions(schema: EnumSchema): EnumOption[] {
  // Check oneOf format
  if (schema.oneOf) {
    return schema.oneOf
  }
  // Check enum format
  if (schema.enum) {
    return schema.enum.map((value) => ({
      const: value,
      title: String(value),
    }))
  }
  
  // Handle schemas without explicit type field (FastMCP scalar elicitation)
  const schemaAsRecord = schema as unknown as Record<string, unknown>
  return extractEnumOptions(schemaAsRecord)
}

/**
 * Validation result for form fields
 */
interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate a string value against a string schema
 */
function validateStringValue(value: string, schema: StringSchema): ValidationResult {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return { isValid: false, error: `Minimum ${schema.minLength} characters required` }
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return { isValid: false, error: `Maximum ${schema.maxLength} characters allowed` }
  }
  if (schema.pattern) {
    const regex = new RegExp(schema.pattern)
    if (!regex.test(value)) {
      return { isValid: false, error: `Invalid format` }
    }
  }
  if (schema.format === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Invalid email format' }
    }
  }
  if (schema.format === 'uri' && value) {
    try {
      new URL(value)
    } catch {
      return { isValid: false, error: 'Invalid URL format' }
    }
  }
  return { isValid: true }
}

/**
 * Validate a number value against a number schema
 */
function validateNumberValue(value: number | undefined, schema: NumberSchema): ValidationResult {
  if (value === undefined || isNaN(value)) {
    return { isValid: true } // Required check is handled separately
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    return { isValid: false, error: `Minimum value is ${schema.minimum}` }
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    return { isValid: false, error: `Maximum value is ${schema.maximum}` }
  }
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    return { isValid: false, error: `Value must be greater than ${schema.exclusiveMinimum}` }
  }
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    return { isValid: false, error: `Value must be less than ${schema.exclusiveMaximum}` }
  }
  if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
    return { isValid: false, error: `Value must be a multiple of ${schema.multipleOf}` }
  }
  return { isValid: true }
}

export default function ElicitationDialog() {
  const { t } = useTranslation()
  const { isModalOpen, modalProps } = useElicitationDialog()
  const serviceHub = useServiceHub()
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = modalProps?.request.requestedSchema

  // Debug: Log the received schema to understand its structure
  useEffect(() => {
    if (schema) {
      const schemaAsRecord = schema as unknown as Record<string, unknown>
      console.log('=== ElicitationDialog Debug ===')
      console.log('Raw schema object:', schema)
      console.log('Schema JSON:', JSON.stringify(schema, null, 2))
      console.log('Schema.type:', schema.type)
      console.log('Schema keys:', Object.keys(schemaAsRecord))
      console.log('Has enum key:', 'enum' in schemaAsRecord)
      console.log('Enum value:', schemaAsRecord['enum'])
      console.log('Enum is array:', Array.isArray(schemaAsRecord['enum']))
      console.log('Has oneOf:', 'oneOf' in schemaAsRecord)
      console.log('Has anyOf:', 'anyOf' in schemaAsRecord)
      console.log('hasEnumOptions result:', hasEnumOptions(schemaAsRecord))
      console.log('extractEnumOptions result:', extractEnumOptions(schemaAsRecord))
      console.log('isEnumSchema result:', isEnumSchema(schema))
      console.log('=== End Debug ===')
    }
  }, [schema])

  // Determine if this is a top-level schema (not object with properties)
  const isTopLevelSchema = useMemo(() => {
    if (!schema) return false
    return !isObjectSchema(schema)
  }, [schema])

  // Reset form when modal opens with a new request
  useEffect(() => {
    if (modalProps?.request) {
      // Initialize form with default values
      const defaults: Record<string, unknown> = {}
      const requestSchema = modalProps.request.requestedSchema

      if (isObjectSchema(requestSchema) && requestSchema.properties) {
        for (const [key, prop] of Object.entries(requestSchema.properties)) {
          if (prop.default !== undefined) {
            defaults[key] = prop.default
          }
        }
      } else if (requestSchema.default !== undefined) {
        // Top-level schema default
        defaults['_value'] = requestSchema.default
      }

      setFormValues(defaults)
      setValidationErrors({})
    }
  }, [modalProps?.request.id])

  if (!modalProps) {
    return null
  }

  const { request, onRespond } = modalProps

  const validateForm = (): boolean => {
    if (!schema) return false
    
    const errors: Record<string, string> = {}

    if (isObjectSchema(schema)) {
      const objectSchema = schema
      const required = objectSchema.required || []

      for (const [key, prop] of Object.entries(objectSchema.properties || {})) {
        if (!prop) continue
        
        const value = formValues[key]
        const isRequired = required.includes(key)

        // Check required
        if (isRequired && (value === undefined || value === '')) {
          errors[key] = 'This field is required'
          continue
        }

        // Check for enum options on any property schema
        const propAsRecord = prop as unknown as Record<string, unknown>
        if (hasEnumOptions(propAsRecord)) {
          const enumOptions = extractEnumOptions(propAsRecord)
          const result = validateEnumValue(value, enumOptions)
          if (!result.isValid && result.error) {
            errors[key] = result.error
          }
        }
        // Type-specific validation
        else if (isStringSchema(prop) && typeof value === 'string') {
          const result = validateStringValue(value, prop)
          if (!result.isValid && result.error) {
            errors[key] = result.error
          }
        } else if (isNumberSchema(prop) && typeof value === 'number') {
          const result = validateNumberValue(value, prop)
          if (!result.isValid && result.error) {
            errors[key] = result.error
          }
        }
      }
    } else if (isEnumSchema(schema)) {
      // Standard enum schema validation
      const value = formValues['_value']
      
      // Check required for top-level schemas
      if (value === undefined || value === '') {
        errors['_value'] = 'This field is required'
      } else {
        const options = getEnumOptions(schema)
        const result = validateEnumValue(value, options)
        if (!result.isValid && result.error) {
          errors['_value'] = result.error
        }
      }
    } else if (hasEnumOptions(schema as unknown as Record<string, unknown>)) {
      // Extended enum validation for anyOf/oneOf/enum formats
      const value = formValues['_value']
      
      // Check required for top-level schemas
      if (value === undefined || value === '') {
        errors['_value'] = 'This field is required'
      } else {
        const enumOptions = extractEnumOptions(schema as unknown as Record<string, unknown>)
        const result = validateEnumValue(value, enumOptions)
        if (!result.isValid && result.error) {
          errors['_value'] = result.error
        }
      }
    } else if (isStringSchema(schema)) {
      const value = formValues['_value'] as string | undefined
      if (schema.minLength !== undefined || schema.maxLength !== undefined || schema.pattern || schema.format) {
        const result = validateStringValue(value || '', schema)
        if (!result.isValid && result.error) {
          errors['_value'] = result.error
        }
      }
    } else if (isNumberSchema(schema)) {
      const value = formValues['_value'] as number | undefined
      const result = validateNumberValue(value, schema)
      if (!result.isValid && result.error) {
        errors['_value'] = result.error
      }
    } else if (isMultiSelectEnumSchema(schema)) {
      const value = formValues['_value'] as unknown[] | undefined
      if (schema.minItems !== undefined && (!value || value.length < schema.minItems)) {
        errors['_value'] = `At least ${schema.minItems} item(s) required`
      }
      if (schema.maxItems !== undefined && value && value.length > schema.maxItems) {
        errors['_value'] = `Maximum ${schema.maxItems} item(s) allowed`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (action: ElicitationAction) => {
    if (action === 'accept' && !validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Convert form values to content based on schema type
      let content: Record<string, unknown> | undefined

      if (action === 'accept') {
        if (isTopLevelSchema) {
          // For top-level schemas, return just the value
          content = { value: formValues['_value'] }
        } else {
          content = formValues
        }
      }

      // Send response to backend
      await serviceHub.mcp().respondToElicitation(request.id, action, content)

      // Close modal and resolve promise
      onRespond(action, content)
    } catch (error) {
      console.error('Failed to respond to elicitation:', error)
      // Still close the modal on error
      onRespond('cancel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDialogOpen = (open: boolean) => {
    if (!open && !isSubmitting) {
      handleSubmit('cancel')
    }
  }

  // Get title from schema or use key
  const getFieldLabel = (key: string, propSchema: ElicitationSchema): string => {
    return propSchema.title || propSchema.description || key
  }

  // Render a single form field based on schema type
  const renderField = (
    key: string,
    propSchema: ElicitationSchema,
    isRequired: boolean = false
  ): React.ReactNode => {
    const value = formValues[key]
    const error = validationErrors[key]

    const label = getFieldLabel(key, propSchema)

    // String input
    if (isStringSchema(propSchema)) {
      const stringSchema = propSchema
      const inputType = stringSchema.format === 'password' ? 'password' : 
                        stringSchema.format === 'email' ? 'email' :
                        stringSchema.format === 'uri' ? 'url' : 'text'

      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="text-sm font-medium flex items-center gap-1">
            {label}
            {isRequired && <span className="text-destructive">*</span>}
          </label>
          <Input
            id={key}
            type={inputType}
            value={(value as string) || ''}
            onChange={(e) => {
              setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
              if (error) {
                setValidationErrors((prev) => {
                  const next = { ...prev }
                  delete next[key]
                  return next
                })
              }
            }}
            disabled={isSubmitting}
            placeholder={stringSchema.description || label}
            minLength={stringSchema.minLength}
            maxLength={stringSchema.maxLength}
            className={cn(error && 'border-destructive')}
          />
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {stringSchema.minLength !== undefined && stringSchema.maxLength !== undefined && (
            <p className="text-xs text-muted-foreground">
              {stringSchema.minLength}-{stringSchema.maxLength} characters
            </p>
          )}
        </div>
      )
    }

    // Number input
    if (isNumberSchema(propSchema)) {
      const numberSchema = propSchema
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="text-sm font-medium flex items-center gap-1">
            {label}
            {isRequired && <span className="text-destructive">*</span>}
          </label>
          <Input
            id={key}
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => {
              const numValue = e.target.value ? parseFloat(e.target.value) : undefined
              setFormValues((prev) => ({ ...prev, [key]: numValue }))
              if (error) {
                setValidationErrors((prev) => {
                  const next = { ...prev }
                  delete next[key]
                  return next
                })
              }
            }}
            disabled={isSubmitting}
            placeholder={numberSchema.description || label}
            min={numberSchema.minimum ?? numberSchema.exclusiveMinimum}
            max={numberSchema.maximum ?? numberSchema.exclusiveMaximum}
            step={numberSchema.type === 'integer' ? 1 : 'any'}
            className={cn(error && 'border-destructive')}
          />
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {numberSchema.minimum !== undefined && numberSchema.maximum !== undefined && (
            <p className="text-xs text-muted-foreground">
              Range: {numberSchema.minimum} - {numberSchema.maximum}
            </p>
          )}
        </div>
      )
    }

    // Boolean checkbox
    if (isBooleanSchema(propSchema)) {
      return (
        <div key={key} className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={key}
            checked={value === true}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.checked }))}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-main-view-fg/20 accent-primary"
          />
          <label htmlFor={key} className="text-sm font-medium">
            {label}
          </label>
        </div>
      )
    }

    // Single-select enum (oneOf or enum) - rendered as radio buttons for easier selection
    if (isEnumSchema(propSchema)) {
      const options = getEnumOptions(propSchema)
      return (
        <div key={key} className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            {label}
            {isRequired && <span className="text-destructive">*</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = value === option.const
              return (
                <button
                  key={String(option.const)}
                  type="button"
                  onClick={() => {
                    setFormValues((prev) => ({ ...prev, [key]: option.const }))
                    if (error) {
                      setValidationErrors((prev) => {
                        const next = { ...prev }
                        delete next[key]
                        return next
                      })
                    }
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                    isSelected
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-main-view-fg/1 border-main-view-fg/20 hover:bg-main-view-fg/5",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center",
                    isSelected ? "border-primary" : "border-main-view-fg/30"
                  )}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  {option.title || String(option.const)}
                </button>
              )
            })}
          </div>
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      )
    }

    // Extended enum schema (anyOf/oneOf/enum at top level - handles FastMCP/Pydantic Literal types)
    // Also rendered as radio buttons for consistency
    const propAsRecord = propSchema as unknown as Record<string, unknown>
    if (hasEnumOptions(propAsRecord)) {
      const options = extractEnumOptions(propAsRecord)
      return (
        <div key={key} className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            {label}
            {isRequired && <span className="text-destructive">*</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = value === option.const
              return (
                <button
                  key={String(option.const)}
                  type="button"
                  onClick={() => {
                    setFormValues((prev) => ({ ...prev, [key]: option.const }))
                    if (error) {
                      setValidationErrors((prev) => {
                        const next = { ...prev }
                        delete next[key]
                        return next
                      })
                    }
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                    isSelected
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-main-view-fg/1 border-main-view-fg/20 hover:bg-main-view-fg/5",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center",
                    isSelected ? "border-primary" : "border-main-view-fg/30"
                  )}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  {option.title || String(option.const)}
                </button>
              )
            })}
          </div>
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      )
    }

    // Multi-select enum (array with anyOf items)
    if (isMultiSelectEnumSchema(propSchema)) {
      const options = propSchema.items.anyOf || []
      const selectedValues = (value as (string | number | boolean)[]) || []

      const toggleOption = (optionValue: string | number | boolean) => {
        const current = [...selectedValues]
        const index = current.findIndex((v) => v === optionValue)

        if (index >= 0) {
          current.splice(index, 1)
        } else {
          // Check maxItems constraint
          if (propSchema.maxItems === undefined || current.length < propSchema.maxItems) {
            current.push(optionValue)
          }
        }

        setFormValues((prev) => ({ ...prev, [key]: current }))
      }

      return (
        <div key={key} className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            {label}
            {isRequired && <span className="text-destructive">*</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.const)
              return (
                <button
                  key={String(option.const)}
                  type="button"
                  onClick={() => toggleOption(option.const)}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                    isSelected
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-main-view-fg/1 border-main-view-fg/20 hover:bg-main-view-fg/5",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center",
                    isSelected ? "bg-primary border-primary" : "border-main-view-fg/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  {option.title || String(option.const)}
                </button>
              )
            })}
          </div>
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {propSchema.minItems !== undefined && propSchema.maxItems !== undefined && (
            <p className="text-xs text-muted-foreground">
              Select {propSchema.minItems}-{propSchema.maxItems} options
            </p>
          )}
        </div>
      )
    }

    return null
  }

  // Render content based on schema type
  const renderFormContent = (): React.ReactNode => {
    if (!schema) return null

    // Object schema with properties (traditional format)
    if (isObjectSchema(schema)) {
      const properties = schema.properties || {}
      const required = schema.required || []

      return (
        <div className="space-y-4 py-4">
          {Object.entries(properties).map(([key, prop]) =>
            renderField(key, prop, required.includes(key))
          )}
        </div>
      )
    }

    // Top-level schemas (new format)
    return (
      <div className="space-y-4 py-4">
        {renderField('_value', schema, true)}
      </div>
    )
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleDialogOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[700px] max-w-[90vw]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-primary">
              <MessageSquareQuote className="size-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {schema?.title || t('elicitation:title', { defaultValue: 'Server Request' })}
                <span className="text-xs font-normal text-main-view-fg/60 bg-main-view-fg/10 px-2 py-0.5 rounded">
                  {request.server}
                </span>
              </DialogTitle>
              <div className="mt-2 text-main-view-fg/80">
                <RenderMarkdown content={request.message} />
              </div>
            </div>
          </div>
        </DialogHeader>

        {renderFormContent()}

        <div className="bg-main-view-fg/1 p-3 border border-main-view-fg/5 rounded-lg">
          <p className="text-xs text-main-view-fg/60">
            {t('elicitation:securityNotice', { defaultValue: 'This request is from an MCP server. Only provide information you trust this server with.' })}
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="link"
              onClick={() => handleSubmit('cancel')}
              disabled={isSubmitting}
              className="text-main-view-fg/60"
            >
              {t('elicitation:cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Button
              variant="link"
              onClick={() => handleSubmit('decline')}
              disabled={isSubmitting}
            >
              {t('elicitation:decline', { defaultValue: 'Decline' })}
            </Button>
            <Button
              variant="default"
              onClick={() => handleSubmit('accept')}
              disabled={isSubmitting}
              autoFocus
            >
              {t('elicitation:accept', { defaultValue: 'Accept' })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}