interface PlaceholderPageProps {
  title: string;
  description: string;
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>

      <p className="text-slate-500">{description}</p>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-400">
          This module is under development.
        </p>
      </div>
    </div>
  );
}

export default PlaceholderPage;
