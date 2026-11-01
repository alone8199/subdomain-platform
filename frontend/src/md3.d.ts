/**
 * 允许在 JSX 中直接使用 Material Web（@material/web）自定义元素，
 * 如 <md-filled-button />、<md-outlined-text-field /> 等。
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

export {}
