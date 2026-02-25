/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useCallback, useMemo } from 'react'
import type { UIMessage, ChatStatus } from 'ai'
import { RenderMarkdown } from './RenderMarkdown'
import { cn } from '@/lib/utils'
import { twMerge } from 'tailwind-merge'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { CopyButton } from './CopyButton'
import { useModelProvider } from '@/hooks/useModelProvider'
import { IconRefresh, IconPaperclip } from '@tabler/icons-react'
import { EditMessageDialog } from '@/containers/dialogs/EditMessageDialog'
import { DeleteMessageDialog } from '@/containers/dialogs/DeleteMessageDialog'
import TokenSpeedIndicator from '@/containers/TokenSpeedIndicator'
import { extractFilesFromPrompt, FileMetadata } from '@/lib/fileMetadata'
import { parseReasoning } from '@/lib/messages'
import { Button } from '@/components/ui/button'

const CHAT_STATUS = {
  STREAMING: 'streaming',
  SUBMITTED: 'submitted',
} as const

const CONTENT_TYPE = {
  TEXT: 'text',
  FILE: 'file',
  REASONING: 'reasoning',
} as const

export type MessageItemProps = {
  message: UIMessage
  isFirstMessage: boolean
  isLastMessage: boolean
  status: ChatStatus
  reasoningContainerRef?: React.RefObject<HTMLDivElement | null>
  onRegenerate?: (messageId: string) => void
  onEdit?: (messageId: string, newText: string) => void
  onDelete?: (messageId: string) => void
  assistant?: { avatar?: React.ReactNode; name?: string }
  showAssistant?: boolean
}

export const MessageItem = memo(
  ({
    message,
    isLastMessage,
    status,
    reasoningContainerRef,
    onRegenerate,
    onEdit,
    onDelete,
  }: MessageItemProps) => {
    const selectedModel = useModelProvider((state) => state.selectedModel)
    const [previewImage, setPreviewImage] = useState<{
      url: string
      filename?: string
    } | null>(null)


    const handleRegenerate = useCallback(() => {
      onRegenerate?.(message.id)
    }, [onRegenerate, message.id])

    const handleEdit = useCallback(
      (newText: string) => {
        onEdit?.(message.id, newText)
      },
      [onEdit, message.id]
    )

    const handleDelete = useCallback(() => {
      onDelete?.(message.id)
    }, [onDelete, message.id])

    // Get image URLs from file parts for the edit dialog
    const imageUrls = useMemo(() => {
      return message.parts
        .filter((part) => {
          if (part.type !== 'file') return false
          const filePart = part as { type: 'file'; url?: string; mediaType?: string }
          return filePart.url && filePart.mediaType?.startsWith('image/')
        })
        .map((part) => (part as { url: string }).url)
    }, [message.parts])

    const isStreaming = isLastMessage && status === CHAT_STATUS.STREAMING

    // Extract file metadata from message text (for user messages with attachments)
    const attachedFiles = useMemo(() => {
      if (message.role !== 'user') return []

      const textParts = message.parts.filter(
        (part): part is { type: 'text'; text: string } =>
          part.type === CONTENT_TYPE.TEXT
      )

      if (textParts.length === 0) return []

      const { files } = extractFilesFromPrompt(textParts[0].text)
      return files
    }, [message.parts, message.role])

    // Get full text content for copy button
    const getFullTextContent = useCallback(() => {
      return message.parts
        .filter(
          (part): part is { type: 'text'; text: string } =>
            part.type === CONTENT_TYPE.TEXT
        )
        .map((part) => part.text)
        .join('\n')
    }, [message.parts])

    const renderTextPart = (
      part: { type: 'text'; text: string },
      partIndex: number
    ) => {
      if (!part.text || part.text.trim() === '') {
        return null
      }

      const isLastPart = partIndex === message.parts.length - 1

      // For user messages, extract and clean the text from file metadata
      const displayText =
        message.role === 'user'
          ? extractFilesFromPrompt(part.text).cleanPrompt
          : part.text

      if (
        !displayText.trim() &&
        message.role === 'user' &&
        attachedFiles.length === 0
      ) {
        return null
      }

      // For assistant messages, check for think tags in the text
      if (message.role === 'assistant') {
        const { reasoningSegment, textSegment } = parseReasoning(part.text)
        
        // Extract reasoning text from think tags
        // Handles three cases:
        // 1. Full formattext
        // 2. In-progress: text (everything before is reasoning)
        let reasoningText: string | null = null
        let isReasoningInProgress = false
        
        const OPEN_TAG = '<' + 'think>'
        const CLOSE_TAG = '<' + '/think>'
        
        if (reasoningSegment) {
          // Case 1 & 2: Has opening tag
          if (reasoningSegment.includes(OPEN_TAG)) {
            // Extract content after opening tag
            const afterOpen = reasoningSegment.slice(reasoningSegment.indexOf(OPEN_TAG) + OPEN_TAG.length)
            if (afterOpen.includes(CLOSE_TAG)) {
              // Case 1: Completed - has both tags
              reasoningText = afterOpen.slice(0, afterOpen.indexOf(CLOSE_TAG))
            } else {
              // Case 2: In-progress - no closing tag yet
              reasoningText = afterOpen
              isReasoningInProgress = true
            }
          } else if (reasoningSegment.includes(CLOSE_TAG)) {
            // Case 3: Closing tag only - everything before it is reasoning
            reasoningText = reasoningSegment.slice(0, reasoningSegment.indexOf(CLOSE_TAG))
          }
        }

        return (
          <div key={`${message.id}-${partIndex}`} className="w-full">
            {/* Render reasoning in expandable section if present */}
            {reasoningText && (
              <Reasoning
                className="w-full text-muted-foreground mb-4"
                isStreaming={isStreaming && isLastPart && isReasoningInProgress}
                defaultOpen={isStreaming && isLastPart && isReasoningInProgress}
              >
                <ReasoningTrigger />
                <div className="relative">
                  {isStreaming && isReasoningInProgress && (
                    <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-br from-neutral-50 mask-t-from-98% dark:from-background to-transparent pointer-events-none z-10" />
                  )}
                  <div
                    ref={isStreaming && isReasoningInProgress ? reasoningContainerRef : null}
                    className={twMerge(
                      'w-full overflow-auto relative',
                      isStreaming && isReasoningInProgress
                        ? 'max-h-32 opacity-70 mt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                        : 'h-auto opacity-100'
                    )}
                  >
                    <ReasoningContent>{reasoningText}</ReasoningContent>
                  </div>
                </div>
              </Reasoning>
            )}
            {/* Render remaining text content */}
            {textSegment && textSegment.trim() && (
              <RenderMarkdown
                content={textSegment}
                isStreaming={isStreaming && isLastPart && !isReasoningInProgress}
                messageId={message.id}
              />
            )}
          </div>
        )
      }

      return (
        <div key={`${message.id}-${partIndex}`} className="w-full">
          <div className="flex justify-end w-full h-full text-start wrap-break-word whitespace-normal">
            <div className="bg-secondary relative text-foreground p-2 rounded-md inline-block max-w-[80%]">
              {/* Show attached files if any */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((file: FileMetadata, idx: number) => (
                    <div
                      key={`file-${idx}-${file.id}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-secondary border text-xs"
                    >
                      <IconPaperclip
                        size={14}
                        className="text-muted-foreground"
                      />
                      <span className="font-medium">{file.name}</span>
                      {file.injectionMode && (
                        <span className="text-muted-foreground">
                          ({file.injectionMode})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {displayText && (
                <div className="select-text whitespace-pre-wrap">
                  {displayText}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    const renderFilePart = (
      part: {
        type: 'file'
        filename?: string
        url?: string
        mediaType?: string
      },
      partIndex: number
    ) => {
      const isImage = part.mediaType?.startsWith('image/')

      if (message.role === 'user' && isImage && part.url) {
        return (
          <div
            key={`${message.id}-${partIndex}`}
            className="flex justify-end w-full my-2"
          >
            <div className="flex flex-wrap gap-2 max-w-[80%] justify-end">
              <div className="relative">
                <img
                  src={part.url}
                  alt={part.filename || 'Uploaded attachment'}
                  className="size-20 rounded-lg object-cover border cursor-pointer"
                  onClick={() =>
                    setPreviewImage({ url: part.url!, filename: part.filename })
                  }
                />
              </div>
            </div>
          </div>
        )
      }

      if (message.role === 'assistant' && isImage && part.url) {
        return (
          <div key={`${message.id}-${partIndex}`} className="my-2">
            <img
              src={part.url}
              alt={part.filename || 'Generated image'}
              className="max-w-full rounded-md cursor-pointer"
              onClick={() =>
                setPreviewImage({ url: part.url!, filename: part.filename })
              }
            />
          </div>
        )
      }

      return null
    }

    const renderReasoningPart = (
      part: { type: 'reasoning'; text: string },
      partIndex: number
    ) => {
      const isLastPart = partIndex === message.parts.length - 1
      const shouldBeOpen = isStreaming && isLastPart

      return (
        <Reasoning
          key={`${message.id}-${partIndex}`}
          className="w-full text-muted-foreground"
          isStreaming={isStreaming && isLastPart}
          defaultOpen={shouldBeOpen}
        >
          <ReasoningTrigger />
          <div className="relative">
            {isStreaming && (
              <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-br from-neutral-50 mask-t-from-98% dark:from-background to-transparent pointer-events-none z-10" />
            )}
            <div
              ref={isStreaming ? reasoningContainerRef : null}
              className={twMerge(
                'w-full overflow-auto relative',
                isStreaming
                  ? 'max-h-32 opacity-70 mt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                  : 'h-auto opacity-100'
              )}
            >
              <ReasoningContent>{part.text}</ReasoningContent>
            </div>
          </div>
        </Reasoning>
      )
    }

    const renderToolPart = (part: any, partIndex: number) => {
      if (!part.type.startsWith('tool-') || !('state' in part)) {
        return null
      }

      const toolName = part.type.split('-').slice(1).join('-')
      return (
        <Tool
          key={`${message.id}-${partIndex}`}
          state={part.state}
          className="mb-4"
        >
          <ToolHeader
            title={toolName}
            type={`tool-${toolName}` as `tool-${string}`}
            state={part.state}
          />
          <ToolContent title={toolName}>
            {part.input && (
              <ToolInput
                input={
                  typeof part.input === 'string'
                    ? part.input
                    : JSON.stringify(part.input)
                }
              />
            )}
            {part.output && (
              <ToolOutput
                output={part.output}
                resolver={(input) => Promise.resolve(input)}
                errorText={undefined}
              />
            )}
            {part.state === 'output-error' && (
              <ToolOutput
                output={undefined}
                errorText={part.error || part.errorText || 'Tool execution failed'}
                resolver={(input) => Promise.resolve(input)}
              />
            )}
          </ToolContent>
        </Tool>
      )
    }

    return (
      <div className="w-full mb-4">

        {/* Render message parts */}
        {message.parts.map((part, i) => {
          switch (part.type) {
            case CONTENT_TYPE.TEXT:
              return renderTextPart(part as { type: 'text'; text: string }, i)
            case CONTENT_TYPE.FILE:
              return renderFilePart(part as any, i)
            case CONTENT_TYPE.REASONING:
              return renderReasoningPart(
                part as { type: 'reasoning'; text: string },
                i
              )
            default:
              return renderToolPart(part, i)
          }
        })}

        {/* Message actions for user messages */}
        {message.role === 'user' && (
          <div className="flex items-center justify-end gap-1 text-muted-foreground text-xs mt-4">
            <CopyButton text={getFullTextContent()} />

            {onEdit && status !== CHAT_STATUS.STREAMING && (
              <EditMessageDialog
                message={getFullTextContent()}
                imageUrls={imageUrls.length > 0 ? imageUrls : undefined}
                onSave={handleEdit}
              />
            )}

            {onDelete && status !== CHAT_STATUS.STREAMING && (
              <DeleteMessageDialog onDelete={handleDelete} />
            )}
          </div>
        )}

        {/* Message actions for assistant messages (non-tool) */}
        {message.role === 'assistant' && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs mt-1">
              <div
                className={cn(
                  'flex items-center gap-1',
                  isStreaming && 'hidden'
                )}
              >
                <CopyButton text={getFullTextContent()} />

                {onEdit && !isStreaming && (
                  <EditMessageDialog
                    message={getFullTextContent()}
                    onSave={handleEdit}
                  />
                )}

                {onDelete && !isStreaming && (
                  <DeleteMessageDialog onDelete={handleDelete} />
                )}

                {selectedModel && onRegenerate && !isStreaming && isLastMessage && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRegenerate}
                    title="Regenerate response"
                  >
                    <IconRefresh size={16} />
                  </Button>
                )}
              </div>

              <TokenSpeedIndicator
                streaming={isStreaming}
                metadata={
                  message.metadata as Record<string, unknown> | undefined
                }
              />
            </div>
          )}

        {/* Image Preview Dialog */}
        {previewImage && (
          <div
            className="fixed inset-0 z-100 bg-black/50 backdrop-blur-md flex items-center justify-center cursor-pointer"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage.url}
              alt={previewImage.filename || 'Preview'}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Always re-render if streaming and this is the last message
    if (nextProps.isLastMessage && nextProps.status === CHAT_STATUS.STREAMING) {
      return false
    }

    return (
      prevProps.message === nextProps.message &&
      prevProps.isFirstMessage === nextProps.isFirstMessage &&
      prevProps.isLastMessage === nextProps.isLastMessage &&
      prevProps.status === nextProps.status &&
      prevProps.showAssistant === nextProps.showAssistant
    )
  }
)

MessageItem.displayName = 'MessageItem'
