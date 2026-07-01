export default function PageLoading({ message = 'Loading...' }) {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-busy="true">
      <p className="page-loading__text">{message}</p>
    </div>
  );
}
