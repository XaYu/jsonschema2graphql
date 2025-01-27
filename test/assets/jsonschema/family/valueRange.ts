export const valueRange = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: '#/ValueRange',
  type: 'object',
  title: 'Value Range',
  properties: {
    min: {
      name: 'Minimum',
      type: 'number',
    },
    max: {
      name: 'Maximum',
      type: 'number',
    },
  },
}
