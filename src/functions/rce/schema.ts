export default {
  type: "object",
  properties: {
    code: { type: 'string' },
    lang: { type: 'string' }
  },
  required: ['code']
} as const;
