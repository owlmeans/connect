/** File names as Drive gives them, made into path segments. */
export interface NameUtils {
  /** A Drive title as one storable segment: separators and control characters become `_`, `.`/`..`/empty become `_`. */
  segment: (name: string) => string
  /** The name with `.<extension>` unless it already ends with it (case-insensitive). */
  withExtension: (name: string, extension: string) => string
  /** The file name a `Content-Disposition` carries — `filename*` first — reduced to its last path part. */
  fromDisposition: (header: string | null | undefined) => string | undefined
}
