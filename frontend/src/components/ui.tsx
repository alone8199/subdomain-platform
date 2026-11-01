import { ReactNode, useState } from 'react'

// ===================== 线性图标（MD3 风格） =====================
const ICONS: Record<string, string> = {
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  home: 'M4 11l8-7 8 7 M6 10v9h12v-9',
  dns: 'M12 3 3 8l9 5 9-5-9-5z M3 13l9 5 9-5',
  approval: 'M12 3a9 9 0 100 18 9 9 0 000-18z M8.5 12.5l2.5 2.5 4.5-4.5',
  people:
    'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20a6 6 0 0112 0 M16 11a3 3 0 10-2.2-5 M16 13c3 0 6 1.5 6 4v3',
  settings:
    'M12 8a4 4 0 100 8 4 4 0 000-8z M19.4 13a7.4 7.4 0 000-2l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.4 2.5h4l.4-2.5a7 7 0 001.7-1l2.4 1 2-3.5z',
  history: 'M12 3a9 9 0 109 9 9 9 0 00-9-9z M12 7v5l3 2',
  light_mode:
    'M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v3 M12 20v3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M1 12h3 M20 12h3 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1',
  dark_mode: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
  logout: 'M16 17l5-5-5-5 M21 12H9 M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4',
  copy: 'M16 4h2a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2v-2 M4 16V6a2 2 0 012-2h10',
  delete: 'M6 7h12 M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2 M5 7l1 13a1 1 0 001 1h10a1 1 0 001-1l1-13',
  edit: 'M4 20h4l10-10-4-4L4 16v4z M13.5 6.5l4 4',
  check: 'M5 13l4 4L19 7',
  close: 'M6 6l12 12 M18 6L6 18',
  add: 'M12 5v14 M5 12h14',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  public:
    'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c2.5 2.5 2.5 15 0 18 M12 3c-2.5 2.5-2.5 15 0 18',
  warning:
    'M12 9v4 M12 17h.01 M10.3 3.9 2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  mail: 'M3 7l9 6 9-6 M3 7h18v10H3z',
}

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name] ?? ''} />
    </svg>
  )
}

// ===================== 状态标签（MD3 chip） =====================
const CHIP: Record<string, string> = {
  active: 'chip chip-active',
  pending: 'chip chip-pending',
  rejected: 'chip chip-rejected',
  error: 'chip chip-error',
  deleting: 'chip chip-deleting',
  expired: 'chip chip-expired',
  success: 'chip chip-active',
  failure: 'chip chip-failure',
  disabled: 'chip chip-disabled',
}

export function Badge({ value }: { value: string }) {
  return (
    <span className={CHIP[value] ?? 'chip chip-disabled'}>{value}</span>
  )
}

// ===================== 圆形进度（加载） =====================
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 gap-3 text-on-surface-variant text-sm">
      <svg
        className="animate-spin"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="var(--md-outline-variant)" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 00-9-9"
          stroke="var(--md-primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ?? '加载中…'}
    </div>
  )
}

// ===================== 空状态 =====================
export function EmptyState({
  title,
  hint,
  action,
  icon = 'public',
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface-variant)' }}
      >
        <Icon name={icon} size={26} />
      </div>
      <div className="text-on-surface font-medium">{title}</div>
      {hint && (
        <div className="text-on-surface-variant text-sm mt-1 max-w-sm">{hint}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ===================== 对话框（MD3） =====================
export function Dialog({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--md-scrim)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest shadow-lg w-full max-w-md"
        style={{ borderRadius: 'var(--md-corner-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 pt-6 pb-2 text-lg font-medium text-on-surface"
          style={{ fontFamily: 'inherit' }}
        >
          {title}
        </div>
        <div className="px-6 py-2 text-sm text-on-surface-variant">{children}</div>
        {footer && (
          <div className="px-4 py-4 flex justify-end gap-2">{footer}</div>
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
      <Dialog
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
      </Dialog>
    </>
  )
}

export function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null
  return (
    <div className="text-xs mt-1" style={{ color: 'var(--md-error)' }}>
      {msg}
    </div>
  )
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-medium text-on-surface">{title}</h1>
        {desc && <p className="text-sm text-on-surface-variant mt-1">{desc}</p>}
      </div>
      {actions}
    </div>
  )
}

// ===================== 开关（MD3） =====================
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center rounded-full transition-colors disabled:opacity-50"
      style={{
        width: 52,
        height: 32,
        background: checked ? 'var(--md-primary)' : 'var(--md-surface-variant)',
      }}
    >
      <span
        className="inline-block rounded-full shadow transition-transform duration-150"
        style={{
          width: 24,
          height: 24,
          background: 'var(--md-surface-container-lowest)',
          transform: checked ? 'translateX(24px)' : 'translateX(4px)',
        }}
      />
    </button>
  )
}

// ===================== 复选框（MD3） =====================
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex items-center justify-center rounded-[6px] border transition-colors disabled:opacity-50"
        style={{
          width: 20,
          height: 20,
          borderColor: checked ? 'var(--md-primary)' : 'var(--md-outline)',
          background: checked ? 'var(--md-primary)' : 'transparent',
        }}
      >
        {checked && <Icon name="check" size={16} className="text-on-primary" />}
      </button>
      {label && <span>{label}</span>}
    </label>
  )
}

// 兼容旧引用：Dialog 的别名
export { Dialog as Modal }
