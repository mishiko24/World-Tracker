import { useState, type ReactNode } from "react";

interface CollapsibleProps {
  title: string;
  children: ReactNode;
}

// A section with a clickable header. Collapsed by default.
export function Collapsible({ title, children }: CollapsibleProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={open ? "collapsible open" : "collapsible"}>
      <button className="collapsible-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="collapsible-arrow">▸</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  );
}
