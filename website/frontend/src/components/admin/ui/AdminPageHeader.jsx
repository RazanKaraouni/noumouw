export default function AdminPageHeader({ title, description, actions = null }) {
  return (
    <div className="dashboard-page-header">
      <div>
        <h1 className="dashboard-page-header__title">{title}</h1>
        {description && <p className="dashboard-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
