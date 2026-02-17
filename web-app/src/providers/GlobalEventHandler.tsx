import { useEffect } from 'react'
import { events } from '@janhq/core'
import { listen } from '@tauri-apps/api/event'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useServiceHub } from '@/hooks/useServiceHub'
import { useElicitationDialog } from '@/hooks/useElicitationDialog'

/**
 * GlobalEventHandler handles global events that should be processed across all screens
 * This provider should be mounted at the root level to ensure all screens can benefit from global event handling
 */
export function GlobalEventHandler() {
  const { setProviders } = useModelProvider()
  const serviceHub = useServiceHub()
  const { showElicitationModal } = useElicitationDialog()

  // Handle mcp-elicitation event from backend (Tauri native event)
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      try {
        // Use Tauri's listen() for native events from backend
        unlisten = await listen<{
          id: string
          server: string
          message: string
          requestedSchema: Record<string, unknown>
        }>('mcp-elicitation', (event) => {
          console.log('Received mcp-elicitation event:', event.payload)
          
          showElicitationModal({
            id: event.payload.id,
            server: event.payload.server,
            message: event.payload.message,
            requestedSchema: event.payload.requestedSchema,
          }).then((result) => {
            console.log('Elicitation response:', result)
          }).catch((error) => {
            console.error('Failed to handle elicitation:', error)
          })
        })
      } catch (error) {
        console.error('Failed to setup mcp-elicitation listener:', error)
      }
    }

    setupListener()

    // Cleanup subscription on unmount
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [showElicitationModal])

  // Handle settingsChanged event globally
  useEffect(() => {
    const handleSettingsChanged = async (event: {
      key: string
      value: string
    }) => {
      console.log('Global settingsChanged event:', event)

      // Handle version_backend changes specifically
      if (event.key === 'version_backend') {
        try {
          // Refresh providers to get updated settings from the extension
          const updatedProviders = await serviceHub.providers().getProviders()
          setProviders(updatedProviders)
          console.log('Providers refreshed after version_backend change')
        } catch (error) {
          console.error(
            'Failed to refresh providers after settingsChanged:',
            error
          )
        }
      }

      // Add more global event handlers here as needed
      // For example:
      // if (event.key === 'some_other_setting') {
      //   // Handle other setting changes
      // }
    }

    // Subscribe to the settingsChanged event
    events.on('settingsChanged', handleSettingsChanged)

    // Cleanup subscription on unmount
    return () => {
      events.off('settingsChanged', handleSettingsChanged)
    }
  }, [setProviders, serviceHub])

  // This component doesn't render anything
  return null
}
