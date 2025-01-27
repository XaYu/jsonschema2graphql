import R from 'ramda'

interface ComparatorsKeys {
  [key: string]: string
}

const COMPARATORS = {
  '<': 'LT',
  '<=': 'LTE',
  '>=': 'GTE',
  '>': 'GT',
} as ComparatorsKeys

/** Turns an enum key from JSON schema into one that is safe for GraphQL. */
export function graphqlSafeEnumKey(value: string): string {
  const trim = (s: string) => s.trim()
  const isNum = (s: string): boolean => /^\d/.test(s)
  const safeNum = (s: string): string => (isNum(s) ? `VALUE_${s}` : s)
  const convertComparators = (s: string): string => {
    return Object.keys(COMPARATORS).includes(s) ? COMPARATORS[s] : s
  }
  const sanitize = (s: string) => s.replace(/\W/g, '_')
  return R.compose(sanitize, convertComparators, safeNum, trim)(value)
}
