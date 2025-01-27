export {}
declare global {
  namespace jest {
    interface Matchers<R> {
      toEqualIgnoringWhitespace: (s: string) => R
    }

    interface Expect {
      toEqualIgnoringWhitespace: (s: string) => void
    }
  }
}
