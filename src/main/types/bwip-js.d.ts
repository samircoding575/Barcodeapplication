declare module 'bwip-js' {
  interface ToBufferOptions {
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    backgroundcolor?: string
    paddingwidth?: number
    paddingheight?: number
    [key: string]: unknown
  }

  function toBuffer(options: ToBufferOptions): Promise<Buffer>

  const bwipjs: {
    toBuffer: typeof toBuffer
  }

  export default bwipjs
  export { toBuffer }
}
