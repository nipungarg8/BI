import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

export function ResultsGrid({ rows }: { rows: Record<string, unknown>[] }) {
  const columnDefs = useMemo<ColDef[]>(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).map((key) => ({ field: key, sortable: true, filter: true }))
  }, [rows])

  if (rows.length === 0) {
    return <p>No rows.</p>
  }

  return (
    <div className="ag-theme-quartz" style={{ height: 420, width: '100%' }}>
      <AgGridReact rowData={rows} columnDefs={columnDefs} />
    </div>
  )
}
