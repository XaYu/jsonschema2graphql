import { GraphQLInputType, GraphQLObjectType, GraphQLOutputType, printSchema } from 'graphql'
import { JSONSchema7 } from 'json-schema'

import convert from '../src'
import { EntryPointBuilder } from '../src/@types'
import { approval } from './assets/jsonschema/family/approval'
import { email } from './assets/jsonschema/family/email'
import { family } from './assets/jsonschema/family/family'
import { item } from './assets/jsonschema/family/item'
import { log } from './assets/jsonschema/family/log'
import { objectId } from './assets/jsonschema/family/objectId'
import { timeRange } from './assets/jsonschema/family/timeRange'
import { user } from './assets/jsonschema/family/user'
import { valueRange } from './assets/jsonschema/family/valueRange'
import { readAsset } from './utils/assets'

// Helpers

const testConversion = (jsonSchema: any, schemaText: string, convertOneOfValuesToEnumArray: boolean = true) => {
  const schema = convert({ jsonSchema, entryPoints: undefined, convertOneOfValuesToEnumArray })
  const actualSchemaText = printSchema(schema)
  expect(actualSchemaText).toEqualIgnoringWhitespace(schemaText)
}

function getDefinition(typeName: string, s: string) {
  const queryBlockRegex = new RegExp(`type ${typeName} \\{(\\S|\\s)*?\\}`)
  const queryBlockMatches = s.match(queryBlockRegex)
  if (queryBlockMatches) return queryBlockMatches[0]
  else return undefined
}

// Tests

it('correctly converts basic attribute types', () => {
  const jsonSchema: JSONSchema7 = {
    $id: 'Person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      score: { type: 'number' },
      isMyFriend: { type: 'boolean' },
    },
  }
  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      name: String
      age: Int
      score: Float
      isMyFriend: Boolean
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

it('converts a literal object', () => {
  expect.assertions(1)
  const jsonSchema: JSONSchema7 = {
    $id: '#/person',
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      age: {
        type: 'integer',
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      name: String
      age: Int
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

it('converts a text schema', () => {
  expect.assertions(1)
  const jsonSchema = `{
    "$id": "person",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "age": {
        "type": "integer"
      }
    }
  }`

  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      name: String
      age: Int
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

it('fails on unknown types', () => {
  expect.assertions(1)
  const jsonSchema = JSON.stringify({
    $id: '#/Pizza',
    type: 'object',
    properties: {
      foo: {
        type: 'tweedledee', // <-- invalid type
      },
    },
  })
  const conversion = () => convert({ jsonSchema })
  expect(conversion).toThrow()
})

it('converts descriptions', () => {
  expect.assertions(1)
  const jsonSchema: JSONSchema7 = {
    $id: '#/person',
    type: 'object',
    description: 'An individual human being.',
    properties: {
      name: {
        type: 'string',
        description: 'The full name of the person.',
      },
      age: {
        type: 'integer',
        description: "The elapsed time (in years) since the person's birth.",
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    """
    An individual human being.
    """
    type Person {
      """
      The full name of the person.
      """
      name: String
      """
      The elapsed time (in years) since the person's birth.
      """
      age: Int
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

it('converts array type properties', () => {
  expect.assertions(1)
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      luckyNumbers: {
        type: 'array',
        items: {
          type: 'integer',
        },
      },
      favoriteColors: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      name: String
      luckyNumbers: [Int!]
      favoriteColors: [String!]
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('enforces required attributes', () => {
  const jsonSchema = {
    $id: '#/Widget',
    type: 'object',
    properties: {
      somethingRequired: { type: 'integer' },
      somethingOptional: { type: 'integer' },
      somethingElseRequired: { type: 'integer' },
    },
    required: ['somethingRequired', 'somethingElseRequired'],
  }

  const expectedSchemaText = `
    type Query {
      widgets: [Widget]
    }
    type Widget {
      somethingRequired: Int!
      somethingOptional: Int
      somethingElseRequired: Int!
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles an object with no properties', () => {
  const jsonSchema = {
    $id: '#/EmptyVoid',
    properties: {}, // <-- no properties
    type: 'object',
  }
  const expectedSchemaText = `
    type Query {
      emptyVoids: [EmptyVoid]
    }
    type EmptyVoid {
      _empty: String
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles a reference (using $ref)', () => {
  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      color: {
        type: 'string',
      },
    },
  }
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      color: { type: 'string' },
      bestFriend: {
        $ref: '#/Orange', // <-- reference foreign type using $ref
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }
    type Orange {
      color: String
    }
    type Apple {
      color: String
      bestFriend: Orange
    }
  `
  testConversion([orange, apple], expectedSchemaText)
})

test('handles a reference in an array property', () => {
  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      color: {
        type: 'string',
      },
    },
  }
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      color: { type: 'string' },
      bestFriends: {
        type: 'array', // <-- array type
        items: {
          $ref: '#/Orange', // <-- reference foreign type using $ref
        },
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }
    type Orange {
      color: String
    }
    type Apple {
      color: String
      bestFriends: [Orange!]
    }
  `
  testConversion([orange, apple], expectedSchemaText)
})

test('fails when given an invalid $ref', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      attribute: {
        $ref: '#/Orange',
      },
    },
  }
  const conversion = () => convert({ jsonSchema })
  expect(conversion).toThrow()
})

test('handles self-reference', () => {
  const employee: JSONSchema7 = {
    $id: '#/Employee',
    type: 'object',
    properties: {
      name: { type: 'string' },
      manager: { $ref: '#/Employee' }, // <-- type refers to itself
    },
  }

  const expectedSchemaText = `
    type Query {
      employees: [Employee]
    }
    type Employee {
      name: String
      manager: Employee
    }
  `
  testConversion(employee, expectedSchemaText)
})

test('handles a circular reference', () => {
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      bestFriend: {
        $ref: '#/Orange',
      },
    },
  }

  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      bestFriend: {
        $ref: '#/Apple',
      },
    },
  }

  const expectedSchemaText = `
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }
    type Orange {
      bestFriend: Apple
    }
    type Apple {
      bestFriend: Orange
    }
  `
  testConversion([orange, apple], expectedSchemaText)
})

test('handles references to local $defs', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Contact',
    $defs: {
      address: {
        type: 'object',
        properties: {
          street_address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
        },
      },
    },
    type: 'object',
    properties: {
      name: { type: 'string' },
      billing_address: { $ref: '#/$defs/address' },
      shipping_address: { $ref: '#/$defs/address' },
    },
  }
  const expectedSchemaText = `
    type Query {
      addresses: [Address]
      contacts: [Contact]
    }
    type Address {
      street_address: String
      city: String
      state: String
    }
    type Contact {
      name: String
      billing_address: Address
      shipping_address: Address
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles enum types', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Person',
    type: 'object',
    properties: {
      height: {
        type: 'string',
        enum: ['tall', 'average', 'short'],
      },
    },
  }

  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      height: PersonHeight
    }
    enum PersonHeight {
      tall
      average
      short
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles oneOf const/title values to string type', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/State',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        oneOf: [
          {
            const: 'CA',
            title: 'CALIFORNIA',
          },
          {
            const: 'AL',
            title: 'ALABAMA',
          },
        ],
      },
    },
  }

  const expectedSchemaText = `
    type Query {
      states: [State]
    }
    type State {
      name: String
    }
  `
  testConversion(jsonSchema, expectedSchemaText, false)
})

test('handles oneOf const/title values to enum type', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Fruit',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        oneOf: [
          {
            const: 'BAN',
            title: 'BANANA',
          },
          {
            const: 'ORG',
            title: 'ORANGE',
          },
        ],
      },
    },
  }

  const expectedSchemaText = `
    type Query {
      fruits: [Fruit]
    }
    type Fruit {
      name: FruitName
    }
    enum FruitName {
      BAN
      ORG
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles enum types with invalid characters', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Person',
    type: 'object',
    properties: {
      height: {
        type: 'string',
        enum: ['super-tall', 'average', 'really really short'],
      },
    },
  }

  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      height: PersonHeight
    }
    enum PersonHeight {
      super_tall
      average
      really_really_short
    }
  `

  testConversion(jsonSchema, expectedSchemaText)
})

test('handles enum with comparison symbols', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Comparator',
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['<', '<=', '>=', '>'],
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      comparators: [Comparator]
    }
    type Comparator {
      operator: ComparatorOperator
    }
    enum ComparatorOperator {
      LT
      LTE
      GTE
      GT
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles enum with numeric keys', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Person',
    type: 'object',
    properties: {
      age: {
        type: 'string',
        enum: ['1', '10', '100'],
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      people: [Person]
    }
    type Person {
      age: PersonAge
    }
    enum PersonAge {
      VALUE_1
      VALUE_10
      VALUE_100
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('handles enum with namespace overlapping JS Object internals', () => {
  const jsonSchema: JSONSchema7 = {
    $id: 'Comparator',
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['constructor', '__proto__'],
      },
    },
  }
  const expectedSchemaText = `
    type Query {
      comparators: [Comparator]
    }
    type Comparator {
      operator: ComparatorOperator
    }
    enum ComparatorOperator {
      constructor
      __proto__
    }
  `
  testConversion(jsonSchema, expectedSchemaText)
})

test('fails on enum for non-string properties', () => {
  const jsonSchema: JSONSchema7 = {
    $id: '#/Person',
    type: 'object',
    properties: {
      age: {
        type: 'integer',
        enum: [1, 2, 3],
      },
    },
  }
  const conversion = () => convert({ jsonSchema })
  expect(conversion).toThrow()
})

test('converts `oneOf` schemas (with if/then) to union types', () => {
  const parent: JSONSchema7 = {
    $id: '#/Parent',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
    },
  }
  const child: JSONSchema7 = {
    $id: '#/Child',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
      parent: { $ref: '#/Parent' },
      bestFriend: { $ref: '#/Person' },
      friends: {
        type: 'array',
        items: { $ref: '#/Person' },
      },
    },
  }
  const person: JSONSchema7 = {
    $id: '#/Person',
    oneOf: [
      {
        if: { properties: { type: { const: 'Parent' } } },
        then: { $ref: '#/Parent' },
      },
      {
        if: { properties: { type: { const: 'Child' } } },
        then: { $ref: '#/Child' },
      },
    ],
  }
  const expectedSchemaText = `
    type Query {
      parents: [Parent]
      children: [Child]
      people: [Person]
    }
    type Parent {
      type: String
      name: String
    }
    type Child {
      type: String
      name: String
      parent: Parent
      bestFriend: Person
      friends: [Person!]
    }
    union Person = Parent | Child
  `
  testConversion([parent, child, person], expectedSchemaText)
})

test('converts `oneOf` schemas to union types', () => {
  const parent: JSONSchema7 = {
    $id: '#/Parent',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
    },
  }
  const child: JSONSchema7 = {
    $id: '#/Child',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
      parent: { $ref: '#/Parent' },
      bestFriend: { $ref: '#/Person' },
      friends: {
        type: 'array',
        items: { $ref: '#/Person' },
      },
    },
  }
  const person: JSONSchema7 = {
    $id: '#/Person',
    oneOf: [{ $ref: '#/Parent' }, { $ref: '#/Child' }],
  }
  const expectedSchemaText = `
    type Query {
      parents: [Parent]
      children: [Child]
      people: [Person]
    }
    type Parent {
      type: String
      name: String
    }
    type Child {
      type: String
      name: String
      parent: Parent
      bestFriend: Person
      friends: [Person!]
    }
    union Person = Parent | Child
  `
  testConversion([parent, child, person], expectedSchemaText)
})

test('handles `oneOf` schemas that include anonymous types', () => {
  const thing: JSONSchema7 = {
    $id: '#/Thing',
    oneOf: [
      {
        type: 'string',
      },
      {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
          },
        },
      },
    ],
  }

  const expectedSchemaText = `
    type Query {
      things: [Thing]
    }
    union Thing = String | Thing1
    type Thing1 {
      foo: String
    }
  `
  testConversion(thing, expectedSchemaText)
})

test('converts Person schema', () => {
  const jsonSchema: JSONSchema7 = readAsset('jsonschema/person.json')
  const expectedSchemaText: string = readAsset('graphql/person.graphql')
  testConversion(jsonSchema, expectedSchemaText)
})

test('converts bill schema', () => {
  const jsonSchema: JSONSchema7 = readAsset('jsonschema/bill.json')
  const expectedSchemaText: string = readAsset('graphql/bill.graphql')
  testConversion(jsonSchema, expectedSchemaText)
})

test('converts insurance schema', () => {
  const jsonSchema: JSONSchema7 = readAsset('jsonschema/insurance.json')
  const expectedSchemaText: string = readAsset('graphql/insurance.graphql')
  testConversion(jsonSchema, expectedSchemaText)
})

//
// Family tests

const FAMILY = [
  objectId, //
  email,
  valueRange,
  timeRange,
  item,
  approval,
  log,
  user,
  family,
]

test('converts family schema', () => {
  const jsonSchema = FAMILY as JSONSchema7[]
  const expectedSchemaText: string = readAsset('graphql/family.graphql')
  testConversion(jsonSchema, expectedSchemaText)
})

test('builds custom query and mutation blocks', () => {
  const jsonSchema = FAMILY as JSONSchema7

  const entryPoints: EntryPointBuilder = (types) => {
    return {
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          family: { type: types['Family'] as GraphQLOutputType },
          user: {
            type: types['User'] as GraphQLOutputType,
            args: {
              email: { type: types['Email'] as GraphQLInputType },
            },
          },
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          stop: { type: types['Log'] as GraphQLOutputType },
        },
      }),
    }
  }

  const schema = convert({ jsonSchema, entryPoints })
  const actualSchemaText = printSchema(schema)

  // Query
  const actualQueryBlock = getDefinition('Query', actualSchemaText)
  const expectedQueryBlock: string = `
      type Query {
        family: Family
        user(email: String): User
      }`
  expect(actualQueryBlock).toEqualIgnoringWhitespace(expectedQueryBlock)

  // Mutation
  const actualMutationBlock = getDefinition('Mutation', actualSchemaText)
  const expectedMutationBlock: string = `
      type Mutation {
        stop: Log
      }`
  expect(actualMutationBlock).toEqualIgnoringWhitespace(expectedMutationBlock)
})
