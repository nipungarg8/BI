// Thin wrapper around the Gemini API (Google AI Studio free tier). Uses
// the raw REST endpoints so no SDK dependency is needed in Deno.
// GEMINI_API_KEY must be set as an Edge Function secret.
// Free-tier prompts may be used by Google to improve their models, so only
// ever send sample/demo data through this, never real customer data.

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
const GEMINI_EMBEDDING_MODEL = Deno.env.get('GEMINI_EMBEDDING_MODEL') ?? 'text-embedding-004'
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

function apiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return key
}

const NL_TO_QUERY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    table: { type: 'STRING' },
    columns: { type: 'ARRAY', items: { type: 'STRING' } },
    rules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING' },
          operator: {
            type: 'STRING',
            enum: ['=', '!=', '<', '<=', '>', '>=', 'contains', 'beginsWith', 'endsWith', 'null', 'notNull', 'in'],
          },
          value: { type: 'STRING' },
        },
        required: ['field', 'operator'],
      },
    },
    limit: { type: 'INTEGER' },
    explanation: { type: 'STRING' },
  },
  required: ['table', 'columns', 'rules', 'explanation'],
}

export interface NlToQueryResult {
  table: string
  columns: string[]
  rules: { field: string; operator: string; value?: string }[]
  limit?: number
  explanation: string
}

function schemaToPrompt(schema: Record<string, { columnName: string; dataType: string }[]>): string {
  return Object.entries(schema)
    .map(([table, cols]) => `- ${table}(${cols.map((c) => `${c.columnName}: ${c.dataType}`).join(', ')})`)
    .join('\n')
}

export async function nlToStructuredQuery(
  schema: Record<string, { columnName: string; dataType: string }[]>,
  question: string
): Promise<NlToQueryResult> {
  const prompt = `You translate a natural-language question into a single read-only query over one table.

Available tables and columns (only these may be used):
${schemaToPrompt(schema)}

Question: "${question}"

Pick exactly one table. Only reference columns that exist on that table. If no filter is needed, return an empty rules array. Keep "value" as a plain string even for numbers.`

  const res = await fetch(
    `${BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: NL_TO_QUERY_SCHEMA,
        },
      }),
    }
  )

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Gemini request failed')
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')

  return JSON.parse(text) as NlToQueryResult
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `${BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    }
  )

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Gemini embedding request failed')
  }

  return json.embedding.values as number[]
}
