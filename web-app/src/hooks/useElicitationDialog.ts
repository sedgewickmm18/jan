import { create } from 'zustand'
import type { ElicitationAction } from '@/types/events'

export type ElicitationRequest = {
  id: string
  server: string
  message: string
  requestedSchema: Record<string, unknown>
}

export type ElicitationModalProps = {
  request: ElicitationRequest
  onRespond: (action: ElicitationAction, content?: Record<string, unknown>) => void
}

type ElicitationState = {
  isModalOpen: boolean
  modalProps: ElicitationModalProps | null
  pendingRequests: ElicitationRequest[]

  // Actions
  showElicitationModal: (request: ElicitationRequest) => Promise<{ action: ElicitationAction; content?: Record<string, unknown> }>
  closeModal: () => void
  setModalOpen: (open: boolean) => void
  addPendingRequest: (request: ElicitationRequest) => void
  removePendingRequest: (id: string) => void
}

export const useElicitationDialog = create<ElicitationState>()((set, get) => ({
  isModalOpen: false,
  modalProps: null,
  pendingRequests: [],

  showElicitationModal: (request: ElicitationRequest) => {
    return new Promise<{ action: ElicitationAction; content?: Record<string, unknown> }>((resolve) => {
      set({
        isModalOpen: true,
        modalProps: {
          request,
          onRespond: (action: ElicitationAction, content?: Record<string, unknown>) => {
            get().closeModal()
            resolve({ action, content })
          },
        },
      })
    })
  },

  closeModal: () => {
    set({
      isModalOpen: false,
      modalProps: null,
    })
  },

  setModalOpen: (open: boolean) => {
    set({ isModalOpen: open })
    if (!open) {
      // If closing without response, treat as cancel
      const props = get().modalProps
      if (props) {
        props.onRespond('cancel')
      }
      get().closeModal()
    }
  },

  addPendingRequest: (request: ElicitationRequest) => {
    set((state) => ({
      pendingRequests: [...state.pendingRequests, request],
    }))
  },

  removePendingRequest: (id: string) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
    }))
  },
}))