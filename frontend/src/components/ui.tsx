import { ReactNode, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/* =====================================================================
   官方 Material Design 3 组件 —— @material/web（Google 官方 MD3 Web 实现）
   这里只做「React 受控封装」，所有视觉与交互均由官方组件提供，
   不再手写任何 MD3 样式组件。主题通过 --md-sys-color-* 令牌注入。
   ===================================================================== */
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'
import '@material/web/switch/switch.js'
import '@material/web/checkbox/checkbox.js'
import '@material/web/dialog/dialog.js'
import '@material/web/icon/icon.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/progress/circular-progress.js'
import '@material/web/chips/assist-chip.js'
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js'
import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js'
import type { MdSwitch } from '@material/web/switch/switch.js'
import type { MdCheckbox } from '@material/web/checkbox/checkbox.js'
import type { MdDialog } from '@material/web/dialog/dialog.js'

// ===================== 图标（官方 md-icon + Material Symbols 字体） =====================
// 旧命名 -> Material Symbols 官方连字名
const LIGATURE: Record<string, string> = {
  approval: 'check_circle',
  people: 'group',
  copy: 'content_copy',
  back: 'arrow_back',
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
    <md-icon
      className={className}
      style={{ fontSize: size, width: `${size}px`, height: `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {LIGATURE[name] ?? name}
    </md-icon>
  )
}

// ===================== 状态标签（官方 md-assist-chip） =====================
const CHIP_COLOR: Record<string, [string, string]> = {
  active: ['var(--md-sys-color-primary-container)', 'var(--md-sys-color-on-primary-container)'],
  success: ['var(--md-sys-color-primary-container)', 'var(--md-sys-color-on-primary-container)'],
  pending: ['#fde9c8', '#6b4a00'],
  rejected: ['var(--md-sys-color-error-container)', 'var(--md-sys-color-on-error-container)'],
  error: ['var(--md-sys-color-error-container)', 'var(--md-sys-color-on-error-container)'],
  failure: ['var(--md-sys-color-error-container)', 'var(--md-sys-color-on-error-container)'],
}

export function Badge({ value }: { value: string }) {
  const [bg, fg] =
    CHIP_COLOR[value] ?? [
      'var(--md-sys-color-surface-container-high)',
      'var(--md-sys-color-on-surface-variant)',
    ]
  return (
    <md-assist-chip
      label={value}
      style={
        {
          '--md-sys-color-secondary-container': bg,
          '--md-sys-color-on-secondary-container': fg,
        } as CSSProperties
      }
    ></md-assist-chip>
  )
}

// ===================== 圆形进度（官方 md-circular-progress） =====================
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 gap-3 text-on-surface-variant text-sm">
      <md-circular-progress
        indeterminate
        style={{ width: '24px', height: '24px' } as CSSProperties}
      ></md-circular-progress>
      {label ?? '加载中…'}
    </div>
  )
}

// ===================== 按钮（官方 md-filled/outlined/tonal/text-button） =====================
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
  const tag =
    variant === 'outlined'
      ? 'md-outlined-button'
      : variant === 'tonal'
        ? 'md-filled-tonal-button'
        : variant === 'text'
          ? 'md-text-button'
          : 'md-filled-button' // primary / danger
  const cls = [
    variant === 'danger' ? 'md-btn-danger' : '',
    size === 'sm' ? 'md-btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const Tag = tag as any
  return (
    <Tag
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cls}
      style={{ width: fullWidth ? '100%' : undefined, ...style } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

// ===================== 输入框（官方 md-outlined-text-field） =====================
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
  const ref = useRef<MdOutlinedTextField>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const v = String(value ?? '')
    if (el.value !== v) el.value = v
  }, [value])
  const hasErr = typeof error === 'string' ? !!error : !!error
  return (
    <md-outlined-text-field
      ref={ref}
      label={label}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      error={hasErr}
      supporting-text={supportingText || (typeof error === 'string' ? error : '') || ''}
      inputmode={inputMode}
      autocomplete={autoComplete}
      className={className}
      style={style as CSSProperties}
      onInput={(e: any) => onChange?.((e.target as MdOutlinedTextField).value)}
    ></md-outlined-text-field>
  )
}

// ===================== 下拉选择（官方 md-outlined-select） =====================
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
  const ref = useRef<MdOutlinedSelect>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const v = String(value ?? '')
    if (el.value !== v) el.value = v
  }, [value])
  return (
    <md-outlined-select
      ref={ref}
      label={label}
      disabled={disabled}
      className={className}
      style={style as CSSProperties}
      onInput={(e: any) => onChange?.((e.target as MdOutlinedSelect).value)}
    >
      {options.map((o) => (
        <md-select-option key={o.value} value={o.value}>
          <div slot="headline">{o.label}</div>
        </md-select-option>
      ))}
    </md-outlined-select>
  )
}

// ===================== 多行文本（MD3 无官方 textarea，令牌样式原生控件） =====================
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
    <textarea
      className={`md-textarea ${className}`}
      rows={rows}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
    />
  )
}

// ===================== 开关（官方 md-switch） =====================
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const ref = useRef<MdSwitch>(null)
  useEffect(() => {
    if (ref.current && ref.current.selected !== checked) ref.current.selected = checked
  }, [checked])
  return (
    <md-switch
      ref={ref}
      disabled={disabled}
      onInput={(e: any) => onChange?.((e.target as MdSwitch).selected)}
    ></md-switch>
  )
}

// ===================== 复选框（官方 md-checkbox） =====================
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
  const ref = useRef<MdCheckbox>(null)
  useEffect(() => {
    if (ref.current && ref.current.checked !== checked) ref.current.checked = checked
  }, [checked])
  return (
    <span className="inline-flex items-center gap-2 text-sm text-on-surface select-none">
      <md-checkbox
        ref={ref}
        disabled={disabled}
        onInput={(e: any) => onChange?.((e.target as MdCheckbox).checked)}
      ></md-checkbox>
      {label && (
        <span className="cursor-pointer" onClick={() => onChange(!checked)}>
          {label}
        </span>
      )}
    </span>
  )
}

// ===================== 对话框（官方 md-dialog） =====================
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
  const ref = useRef<MdDialog>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.show()
    else if (!open && d.open) d.close()
  }, [open])
  return (
    <md-dialog ref={ref} onClose={() => onClose?.()}>
      <div slot="headline">{title}</div>
      <div slot="content">{children}</div>
      <div slot="actions">{footer}</div>
    </md-dialog>
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
        style={{
          background: 'var(--md-surface-container-high)',
          color: 'var(--md-on-surface-variant)',
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
