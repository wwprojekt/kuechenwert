import { useNavigate } from "react-router-dom";

interface Option {
  id: string;
  label: string;
}

interface InlineCardEntryProps {
  options: Option[];
  sessionKey: string;
  dataField: string;
  nextUrl: string;
}

export function InlineCardEntry({
  options,
  sessionKey,
  dataField,
  nextUrl,
}: InlineCardEntryProps) {
  const navigate = useNavigate();

  function handleSelect(id: string) {
    sessionStorage.setItem(sessionKey, JSON.stringify({ [dataField]: id }));
    navigate(nextUrl);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => handleSelect(opt.id)}
          className="group rounded-xl border-2 border-white/20 bg-white/10 px-4 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-accent-400 hover:bg-white/20"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
