import { useState, useCallback, useEffect } from 'react'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0
let addToastFn: ((text: string, type: ToastMessage['type']) => void) | null = null

export function showToast(text: string, type: ToastMessage['type'] = 'success') {
  addToastFn?.(text, type)
}

export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: ToastMessage['type']) => {
    const id = ++toastId
    setMessages(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id))
    }, 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  const alertClass: Record<string, string> = {
    success: 'alert-success',
    error: 'alert-error',
    info: 'alert-info'
  }

  return (
    <div className="toast toast-end toast-top z-50">
      {messages.map(m => (
        <div key={m.id} className={`alert ${alertClass[m.type]} text-sm py-2`}>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}
