import { createClient } from '../utils/supabase/server'
import { cookies } from 'next/headers'

const tableName = process.env.SUPABASE_TABLE ?? 'todos'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: rows, error } = await supabase.from(tableName).select('*')

  return (
    <main className="page-shell">
      <section className="list-page" aria-labelledby="page-heading">
        <header className="page-header">
          <div>
            <p className="eyebrow">Supabase collection</p>
            <h1 id="page-heading">{tableName}</h1>
          </div>
          {!error && <p className="row-count">{rows?.length ?? 0} rows</p>}
        </header>

        {error ? (
          <div className="status-panel error-panel" role="alert">
            <strong>Could not load this table.</strong>
            <p>{error.message}</p>
            <p>Check that SUPABASE_TABLE matches a table in your Supabase project and that its read policy allows access.</p>
          </div>
        ) : !rows?.length ? (
          <div className="status-panel">
            <strong>No rows yet.</strong>
            <p>Add a row to the {tableName} table in Supabase and refresh this page.</p>
          </div>
        ) : (
          <div className="record-list">
            {rows.map((row, rowIndex) => (
              <article className="record-card" key={row.id ?? rowIndex}>
                <span className="record-number">{String(rowIndex + 1).padStart(2, '0')}</span>
                <dl>
                  {Object.entries(row).map(([column, value]) => (
                    <div className="field" key={column}>
                      <dt>{column.replaceAll('_', ' ')}</dt>
                      <dd>{formatValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}