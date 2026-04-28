import { useNavigate } from "react-router-dom";

interface StyleOption {
  id: string;
  label: string;
  bgClass: string;
}

interface InlineImageEntryProps {
  options: StyleOption[];
  sessionKey: string;
  nextUrl: string;
}

export function InlineImageEntry({
  options,
  sessionKey,
  nextUrl,
}: InlineImageEntryProps) {
  const navigate = useNavigate();

  function handleSelect(id: string) {
    sessionStorage.setItem(sessionKey, JSON.stringify({ styles: [id] }));
    navigate(nextUrl);
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => handleSelect(opt.id)}
          className="group relative overflow-hidden rounded-xl transition hover:ring-2 hover:ring-accent-400 hover:ring-offset-2 hover:ring-offset-brand-950"
        >
          <div
            className={`${opt.bgClass} flex aspect-[4/3] items-end p-4`}
          >
            <span className="text-sm font-bold text-white drop-shadow">
              {opt.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
