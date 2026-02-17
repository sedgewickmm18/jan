import { useState, useEffect } from 'react'
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
import { MessageSquareQuote } from 'lucide-react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { RenderMarkdown } from '@/containers/RenderMarkdown'
import type { ElicitationAction } from '@/types/events'

export default function ElicitationDialog() {
  const { t } = useTranslation()
  const { isModalOpen, modalProps } = useElicitationDialog()
  const serviceHub = useServiceHub()
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens with a new request
  useEffect(() => {
    if (modalProps) {
      setFormValues({})
    }
  }, [modalProps?.request.id])

  if (!modalProps) {
    return null
  }

  const { request, onRespond } = modalProps

  const handleSubmit = async (action: ElicitationAction) => {
    setIsSubmitting(true)
    try {
      // Convert form values to appropriate types based on schema
      const content = action === 'accept' ? convertFormToContent(formValues, request.requestedSchema) : undefined
      
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

  // Parse schema to render form fields
  const schema = request.requestedSchema as {
    type?: string
    properties?: Record<string, { type: string; description?: string; enum?: string[] }>
    required?: string[]
  } | null

  const properties: Record<string, { type: string; description?: string; enum?: string[] }> = 
    (schema?.properties as Record<string, { type: string; description?: string; enum?: string[] }>) || {}
  const requiredFields: string[] = (schema?.required as string[]) || []

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
                {t('elicitation:title', { defaultValue: 'Server Request' })}
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

        {Object.keys(properties).length > 0 && (
          <div className="space-y-4 py-4">
            {Object.entries(properties).map(([key, prop]) => {
              const isRequired = requiredFields.includes(key)
              const currentValue = formValues[key] || ''
              
              // Handle enum fields as select
              if (prop.enum && prop.enum.length > 0) {
                return (
                  <div key={key} className="space-y-2">
                    <label htmlFor={key} className="text-sm font-medium">
                      {prop.description || key}
                      {isRequired && <span className="text-destructive ml-1">*</span>}
                    </label>
                    <select
                      id={key}
                      className="w-full rounded-md border border-main-view-fg/20 bg-main-view-fg/1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={currentValue}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      disabled={isSubmitting}
                    >
                      <option value="">-- {t('common:select', { defaultValue: 'Select' })} --</option>
                      {prop.enum.map((option: string) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }
              
              // Handle boolean fields as checkbox
              if (prop.type === 'boolean') {
                return (
                  <div key={key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={key}
                      checked={currentValue === 'true'}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.checked ? 'true' : 'false' }))}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-main-view-fg/20"
                    />
                    <label htmlFor={key} className="text-sm font-medium">
                      {prop.description || key}
                    </label>
                  </div>
                )
              }
              
              // Handle string/number fields
              return (
                <div key={key} className="space-y-2">
                  <label htmlFor={key} className="text-sm font-medium">
                    {prop.description || key}
                    {isRequired && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Input
                    id={key}
                    type={prop.type === 'number' ? 'number' : 'text'}
                    value={currentValue}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    disabled={isSubmitting}
                    placeholder={prop.description}
                    className="w-full"
                  />
                </div>
              )
            })}
          </div>
        )}

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

// Helper function to convert form values to content based on schema
function convertFormToContent(
  formValues: Record<string, string>,
  schema: Record<string, unknown>
): Record<string, unknown> {
  const content: Record<string, unknown> = {}
  const properties = (schema.properties as Record<string, { type: string }>) || {}

  for (const [key, value] of Object.entries(formValues)) {
    const propType = properties[key]?.type || 'string'
    
    if (propType === 'boolean') {
      content[key] = value === 'true'
    } else if (propType === 'number' || propType === 'integer') {
      const num = parseFloat(value)
      content[key] = isNaN(num) ? 0 : num
    } else {
      content[key] = value
    }
  }

  return content
}
