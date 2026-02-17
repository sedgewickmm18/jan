/**
 * Hook for handling MCP elicitation requests
 * 
 * This hook listens for elicitation events from MCP servers and provides
 * a way to display dialogs to the user and respond to the requests.
 */

import { useEffect, useCallback, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getServiceHub } from './useServiceHub'
import { SystemEvent, type ElicitationRequest, type ElicitationAction } from '@/types/events'

export interface ElicitationState {
  isOpen: boolean
  request: ElicitationRequest | null
}

/**
 * Hook to manage MCP elicitation requests
 * 
 * @returns Object containing elicitation state and response function
 */
export function useElicitation() {
  const [state, setState] = useState<ElicitationState>({
    isOpen: false,
    request: null,
  })

  // Listen for elicitation events
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      unlisten = await listen<ElicitationRequest>(SystemEvent.MCP_Elicitation, (event) => {
        setState({
          isOpen: true,
          request: event.payload,
        })
      })
    }

    setupListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  // Respond to elicitation request
  const respond = useCallback(async (action: ElicitationAction, content?: Record<string, unknown>) => {
    if (!state.request) {
      console.warn('No elicitation request to respond to')
      return
    }

    try {
      await getServiceHub().mcp().respondToElicitation(
        state.request.id,
        action,
        content
      )
    } catch (error) {
      console.error('Failed to respond to elicitation:', error)
    } finally {
      // Close the dialog
      setState({
        isOpen: false,
        request: null,
      })
    }
  }, [state.request])

  // Accept the elicitation with content
  const accept = useCallback((content: Record<string, unknown>) => {
    return respond('accept', content)
  }, [respond])

  // Decline the elicitation
  const decline = useCallback(() => {
    return respond('decline')
  }, [respond])

  // Cancel the elicitation
  const cancel = useCallback(() => {
    return respond('cancel')
  }, [respond])

  // Close without responding (will timeout on backend)
  const close = useCallback(() => {
    setState({
      isOpen: false,
      request: null,
    })
  }, [])

  return {
    ...state,
    respond,
    accept,
    decline,
    cancel,
    close,
  }
}

/**
 * Hook to get a function for showing elicitation dialog
 * This can be used by components that want to manually trigger elicitation handling
 */
export function useElicitationHandler() {
  const [currentElicitation, setCurrentElicitation] = useState<ElicitationRequest | null>(null)

  const showElicitation = useCallback((request: ElicitationRequest) => {
    setCurrentElicitation(request)
  }, [])

  const hideElicitation = useCallback(() => {
    setCurrentElicitation(null)
  }, [])

  const respondToElicitation = useCallback(async (
    elicitationId: string,
    action: ElicitationAction,
    content?: Record<string, unknown>
  ) => {
    try {
      await getServiceHub().mcp().respondToElicitation(elicitationId, action, content)
    } catch (error) {
      console.error('Failed to respond to elicitation:', error)
    } finally {
      setCurrentElicitation(null)
    }
  }, [])

  return {
    currentElicitation,
    showElicitation,
    hideElicitation,
    respondToElicitation,
  }
}