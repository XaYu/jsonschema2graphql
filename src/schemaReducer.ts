import Ajv2020 from 'ajv/dist/2020'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
} from 'graphql'
import { JSONSchema4TypeName, JSONSchema7 } from 'json-schema'
import _, { isArray } from 'lodash'
import uppercamelcase from 'uppercamelcase'
import { GraphQLTypeMap } from './@types'
import { getTypeName } from './getTypeName'
import { graphqlSafeEnumKey } from './graphqlSafeEnumKey'
import { err } from './helpers'
import { getOneOfEnumsSchema, isOneOfEnumsProperty } from './oneOfEnums'

/** Maps basic JSON schema types to basic GraphQL types */
const BASIC_TYPE_MAPPING: Partial<Record<JSONSchema4TypeName, GraphQLScalarType>> = {
  string: GraphQLString,
  integer: GraphQLInt,
  number: GraphQLFloat,
  boolean: GraphQLBoolean,
}

export function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7, convertOneOfValuesToEnumArray: boolean) {
  // validate against the json schema schema
  new Ajv2020().validateSchema(schema)

  const $id = schema.$id
  if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.')

  const typeName = getTypeName($id)

  // $defs
  const $defs = schema.$defs
  for (const definedTypeName in $defs) {
    const definedSchema = $defs[definedTypeName] as JSONSchema7

    knownTypes[uppercamelcase(definedTypeName)] = buildType(
      definedTypeName,
      definedSchema,
      knownTypes,
      convertOneOfValuesToEnumArray
    )
  }

  knownTypes[typeName] = buildType(typeName, schema, knownTypes, convertOneOfValuesToEnumArray)

  return knownTypes
}

function buildType(
  propName: string,
  schema: JSONSchema7,
  knownTypes: GraphQLTypeMap,
  convertOneOfValuesToEnumArray: boolean
): GraphQLType {
  const name = uppercamelcase(propName)

  // oneOf?
  if (!_.isUndefined(schema.oneOf)) {
    // oneOf enums
    if (isOneOfEnumsProperty(schema)) {
      const newSchema = getOneOfEnumsSchema(schema, convertOneOfValuesToEnumArray)

      return buildType(propName, newSchema, knownTypes, convertOneOfValuesToEnumArray) as GraphQLObjectType
    } else {
      // standard oneOf
      const cases = schema.oneOf
      const caseKeys = Object.keys(cases)

      const types: GraphQLObjectType[] = caseKeys.map((caseName) => {
        const caseSchema = cases[caseName as keyof typeof cases] as JSONSchema7
        const qualifiedName = `${name}_${caseName}`
        const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7

        return buildType(qualifiedName, typeSchema, knownTypes, convertOneOfValuesToEnumArray) as GraphQLObjectType
      })

      const description = buildDescription(schema)
      return new GraphQLUnionType({ name, description, types })
    }
  }

  // object?
  else if (schema.type === 'object') {
    const description = buildDescription(schema)
    const fields = () =>
      !_.isEmpty(schema.properties)
        ? _.mapValues(schema.properties, (prop: JSONSchema7, fieldName: string) => {
            const qualifiedFieldName = `${name}.${fieldName}`

            const type = buildType(
              qualifiedFieldName,
              prop,
              knownTypes,
              convertOneOfValuesToEnumArray
            ) as GraphQLObjectType

            const isRequired = _.includes(schema.required, fieldName)

            return {
              type: isRequired ? new GraphQLNonNull(type) : type,
              description: buildDescription(prop),
            }
          })
        : // GraphQL doesn't allow types with no fields, so put a placeholder
          { _empty: { type: GraphQLString } }

    return new GraphQLObjectType({ name, description, fields })
  }

  // array?
  else if (schema.type === 'array') {
    const elementType = buildType(name, schema.items as JSONSchema7, knownTypes, convertOneOfValuesToEnumArray)

    return new GraphQLList(new GraphQLNonNull(elementType))
  }

  // enum?
  else if (!_.isUndefined(schema.enum)) {
    if (schema.type !== 'string') throw err(`Only string enums are supported.`, name)
    const description = buildDescription(schema)
    const graphqlToJsonMap = _.keyBy(schema.enum, graphqlSafeEnumKey)
    const values = _.mapValues(graphqlToJsonMap, (value: string) => ({ value }))
    const enumType = new GraphQLEnumType({ name, description, values })

    return enumType
  }

  // ref?
  else if (!_.isUndefined(schema.$ref)) {
    const ref = getTypeName(schema.$ref)
    const type = knownTypes[ref]

    if (!type) throw err(`The referenced type ${ref} is unknown.`, name)
    return type
  }

  // basic?
  else if (schema.type && !isArray(schema.type) && BASIC_TYPE_MAPPING[schema.type]) {
    return BASIC_TYPE_MAPPING[schema.type] as typeof GraphQLString
  }

  // ¯\_(ツ)_/¯
  else throw err(`The type ${schema.type} on property ${name} is unknown.`)
}

function buildDescription(d: any): string | undefined {
  if (d.title && d.description) return `${d.title}: ${d.description}`
  return d.title || d.description || undefined
}
