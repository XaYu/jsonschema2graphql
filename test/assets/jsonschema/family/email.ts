import { pattern } from './pattern'
export const email = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: '#/Email',
  type: 'string',
  name: 'Email address',
  description: 'RFC5322-compliant email address',
  examples: ['herb@devresults.com'],
  pattern: pattern.EMAIL,
}
