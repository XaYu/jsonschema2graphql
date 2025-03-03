import { JSONSchema7 } from 'json-schema'

/** Checks if a schema property is a oneOf { const, type } property */
export function isOneOfEnumsProperty(schema: JSONSchema7) {
  return schema.type === 'string' && schema.oneOf?.every((item: JSONSchema7) => item['const'])
}

/** Returns a new schema with the current type and creates enum based on const prop of oneOf array */
export function getOneOfEnumsSchema(schema: JSONSchema7, convertOneOfValuesToEnumArray: boolean = false) {
  let newSchema = { ...schema }
  const convertedEum: string[] = []

  for (const schema of newSchema?.oneOf ?? []) {
    const jsonSchema = schema as JSONSchema7

    if (convertOneOfValuesToEnumArray) {
      convertedEum.push(jsonSchema.const as string)
      newSchema = { ...newSchema, enum: convertedEum }
    }
  }

  delete newSchema.oneOf

  return newSchema
}
