import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellValueChangedEvent, ColDef } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

export function ResultsGrid({
  rows,
  editable = false,
  onCellEdited,
}: {
  rows: Record<string, unknown>[]
  editable?: boolean
  onCellEdited?: (rows: Record<string, unknown>[]) => void
}) {
  const columnDefs = useMemo<ColDef[]>(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).map((key) => ({
      field: key,
      sortable: true,
      filter: true,
      editable,
    }))
  }, [rows, editable])

  if (rows.length === 0) {
    return <p>No rows.</p>
  }

  function handleCellValueChanged(event: CellValueChangedEvent) {
    if (!onCellEdited) return
    const updated = [...rows]
    updated[event.rowIndex ?? -1] = { ...event.data }
    onCellEdited(updated)
  }

  return (
    <div className="ag-theme-quartz" style={{ height: 420, width: '100%' }}>
      <AgGridReact
        rowData={rows}
        columnDefs={columnDefs}
        onCellValueChanged={editable ? handleCellValueChanged : undefined}
      />
    </div>
  )
}
