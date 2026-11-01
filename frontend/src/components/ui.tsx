import { ReactNode, useState } from 'react'

// 状态标签（中性、克制）
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  deleting: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  failure: 'bg-red-50 text-red-700 border-red-200',
}

export function Badge({ value }: { value: string }) {
  const style = STATUS_STYLE[value] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${style}`}
    >
      {value}
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
      <span className="w-4 h-4 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
      {label ?? '加载中…'}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-400 text-sm font-medium">{title}</div>
      {hint && <div className="text-gray-400 text-xs mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-md shadow-lg w-full max-w-md">
        <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-800">
          {title}
        </div>
        <div className="px-4 py-3 text-sm text-gray-700">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmButton({
  label,
  confirmText,
  onConfirm,
  className,
}: {
  label: string
  confirmText: string
  onConfirm: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className ?? 'btn-danger btn-sm'} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal
        open={open}
        title="确认操作"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              确认
            </button>
          </>
        }
      >
        {confirmText}
      </Modal>
    </>
  )
}

export function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null
  return <div className="text-xs text-red-600 mt-1">{msg}</div>
}

export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
    </div>
  )
}
