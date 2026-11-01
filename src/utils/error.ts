// 业务异常：携带 code / message / http status，供路由层统一转换为响应。
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
