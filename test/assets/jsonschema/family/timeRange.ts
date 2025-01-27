import { pattern } from './pattern'

export const timeRange = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: '#/TimeRange',
  type: 'object',
  title: 'Time range',
  description: 'Start and end times for an activity.',
  properties: {
    start: {
      type: 'string',
      title: 'Start time',
      pattern: pattern.TIME,
    },
    end: {
      type: 'string',
      title: 'End time',
      pattern: pattern.TIME,
    },
  },
}
