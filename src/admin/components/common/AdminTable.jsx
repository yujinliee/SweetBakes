import './common.css'

function AdminTable({ columns = [], rows = [], emptyText = 'No records found.' }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{row[column.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="admin-table-empty">{emptyText}</td>
              {columns.slice(1).map((column) => (
                <td aria-hidden="true" key={column.key} />
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default AdminTable
