export default function Settings() {
  return (
    <div className="space-y-4">
      <h2 className="text-slate-900">Settings</h2>
      <label className="text-slate-500">Name</label>
      <label className="text-slate-500">Email</label>
      <label className="text-slate-500">Language</label>
      <div className="border-t border-t-slate-200 bg-slate-50 text-slate-500">Danger zone</div>
      <p className="text-error bg-red-50">This cannot be undone.</p>
      <a className="text-brand hover:text-brand-dark">Learn more</a>
    </div>
  );
}
