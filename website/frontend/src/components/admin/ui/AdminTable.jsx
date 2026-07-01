import TableSkeleton from './TableSkeleton.jsx';
import AdminPagination from './AdminPagination.jsx';
import AdminToolbar from './AdminToolbar.jsx';

export default function AdminTable({
  loading = false,
  empty = false,
  emptyMessage = 'No records found.',
  emptyHint,
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  toolbarActions,
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  showPagination = true,
  children,
  skeletonCols = 5,
  tableLayout = 'auto',
  minWidth,
}) {
  return (
    <div className="admin-table-panel">
      {(onSearchChange != null || filters || toolbarActions) && (
        <AdminToolbar
          search={search ?? ''}
          onSearchChange={onSearchChange ?? (() => {})}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          actions={toolbarActions}
        />
      )}

      {loading ? (
        <TableSkeleton cols={skeletonCols} />
      ) : empty ? (
        <div className="admin-table-empty">
          <p className="admin-table-empty-title">{emptyMessage}</p>
          {emptyHint && <p className="admin-table-empty-hint">{emptyHint}</p>}
        </div>
      ) : (
        <>
          <div className="admin-data-table-wrap">
            <div className="admin-data-table-scroll">
              <table
                className={`admin-data-table${tableLayout === 'fixed' ? ' admin-data-table--fixed' : ''}`}
                style={minWidth ? { minWidth } : undefined}
              >
                {children}
              </table>
            </div>
          </div>
          {showPagination && onPageChange && total > 0 && (
            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={total}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

export const adminThClass = 'admin-table-th';

export const adminTdClass = 'admin-table-td';
