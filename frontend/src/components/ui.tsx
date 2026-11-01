import { ReactNode, useState } from 'react'
import type { CSSProperties } from 'react'

/* =====================================================================
   自研 UI 组件库 —— 「靛蓝玻璃拟态」现代风格
   全部为手写组件，零第三方组件库、零外部字体依赖。
   主题令牌见 index.css 的 --ui-*（明/暗双主题）。
   ===================================================================== */

// ===================== 线性图标 =====================
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

// ===================== 状态标签 =====================
const CHIP: Record<string, string> = {
  active: 'ui-chip ui-chip-active',
  pending: 'ui-chip ui-chip-pending',
  rejected: 'ui-chip ui-chip-error',
  error: 'ui-chip ui-chip-error',
  failure: 'ui-chip ui-chip-error',
  deleting: 'ui-chip ui-chip-muted',
  expired: 'ui-chip ui-chip-muted',
  disabled: 'ui-chip ui-chip-muted',
  success: 'ui-chip ui-chip-active',
}

export function Badge({ value }: { value: string }) {
  return <span className={CHIP[value] ?? 'ui-chip ui-chip-muted'}>{value}</span>
}

// ===================== 圆形进度 =====================
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 gap-3 text-on-surface-variant text-sm">
      <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="var(--ui-outline-variant)" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 00-9-9"
          stroke="var(--ui-primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ?? '加载中…'}
    </div>
  )
}

// ===================== 按钮 =====================
export function Button({
  variant = 'primary',
  size,
  disabled,
  onClick,
  type = 'button',
  fullWidth,
  className = '',
  style,
  children,
}: {
  variant?: 'primary' | 'outlined' | 'tonal' | 'text' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  onClick?: (e: any) => void
  type?: 'button' | 'submit'
  fullWidth?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`ui-btn ui-btn-${variant} ${size === 'sm' ? 'ui-btn-sm' : ''} ${className}`.trim()}
      style={{ width: fullWidth ? '100%' : undefined, ...style } as CSSProperties}
    >
      {children}
    </button>
  )
}

// ===================== 输入框 =====================
export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  required,
  error,
  supportingText,
  inputMode,
  autoComplete,
  className = '',
  style,
}: {
  label?: string
  value: string | number
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string | boolean
  supportingText?: string
  inputMode?: 'numeric' | 'text' | 'decimal'
  autoComplete?: string
  className?: string
  style?: CSSProperties
}) {
  const hasErr = typeof error === 'string' ? !!error : !!error
  return (
    <div className={`ui-field ${className}`.trim()} style={style}>
      {label && <label className="label">{label}</label>}
      <input
        className={`ui-input ${hasErr ? 'ui-input-error' : ''}`.trim()}
        type={type}
        value={String(value ?? '')}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {(supportingText || (typeof error === 'string' && error)) && (
        <div className={`ui-field-hint ${hasErr ? 'ui-field-hint-error' : ''}`.trim()}>
          {typeof error === 'string' && error ? error : supportingText}
        </div>
      )}
    </div>
  )
}

// ===================== 下拉选择 =====================
export function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  className = '',
  style,
}: {
  label?: string
  value: string
  onChange?: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`ui-field ${className}`.trim()} style={style}>
      {label && <label className="label">{label}</label>}
      <div className="ui-select-wrap">
        <select
          className="ui-select"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="ui-select-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}

// ===================== 多行文本 =====================
export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
  className = '',
}: {
  label?: string
  value: string
  onChange?: (v: string) => void
  rows?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      {label && <label className="label">{label}</label>}
      <textarea
        className="ui-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

// ===================== 开关 =====================
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
      className={`ui-switch ${checked ? 'ui-switch-on' : ''}`.trim()}
    >
      <span className="ui-switch-thumb" />
    </button>
  )
}

// ===================== 复选框 =====================
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
    <span className="inline-flex items-center gap-2 text-sm text-on-surface select-none">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`ui-checkbox ${checked ? 'ui-checkbox-on' : ''}`.trim()}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      {label && (
        <span className="cursor-pointer" onClick={() => onChange(!checked)}>
          {label}
        </span>
      )}
    </span>
  )
}

// ===================== 对话框 =====================
export function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
  width,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  width?: 'normal' | 'wide'
}) {
  if (!open) return null
  return (
    <div className="ui-modal-mask" onClick={onClose}>
      <div
        className="ui-modal"
        style={width === 'wide' ? { maxWidth: '760px', width: '94vw' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-head">
          <h2 className="ui-modal-title">{title}</h2>
          <button className="ui-modal-x" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
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
      <Button variant="danger" size="sm" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        title="确认操作"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              确认
            </Button>
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
    <div className="text-xs mt-1" style={{ color: 'var(--ui-error)' }}>
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
        <h1 className="text-xl font-semibold text-on-surface">{title}</h1>
        {desc && <p className="text-sm text-on-surface-variant mt-1">{desc}</p>}
      </div>
      {actions}
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
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
        style={{
          background: 'var(--ui-primary-container)',
          color: 'var(--ui-primary)',
        }}
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

// 兼容旧引用：Dialog 的别名
export { Dialog as Modal }
