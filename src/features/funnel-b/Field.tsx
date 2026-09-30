import { cloneElement, isValidElement, useId, type ReactNode } from "react";

const LABELLED_CONTROLS = new Set(["input", "select", "textarea"]);

/**
 * Beschriftetes Feld. Ein einzelnes input/select/textarea bekommt Label und Hinweis
 * per id; steckt das Feld in einem Wrapper, verweist controlId auf das innere Feld.
 * Alles andere (Kachelgruppen, Combobox) wird als benannte Gruppe ausgezeichnet.
 */
export function Field({
  id,
  label,
  hint,
  controlId,
  children,
}: {
  /** id der Gruppe (Kachelgruppen), z. B. als Sprungziel für fehlende Angaben. */
  id?: string;
  label: string;
  hint?: string;
  controlId?: string;
  children: ReactNode;
}) {
  const baseId = useId();
  const hintId = hint ? `${baseId}-hint` : undefined;
  const hintNode = hint && (
    <p id={hintId} className="helper-text xshort:hidden">
      {hint}
    </p>
  );
  const control =
    !controlId && isValidElement<{ id?: string; "aria-describedby"?: string }>(children) &&
    typeof children.type === "string" && LABELLED_CONTROLS.has(children.type)
      ? children
      : null;

  if (control || controlId) {
    const cid = controlId ?? control?.props.id ?? `${baseId}-control`;
    return (
      <div>
        <label htmlFor={cid} className="label-field mb-1 block">
          {label}
        </label>
        {control ? cloneElement(control, { id: cid, "aria-describedby": hintId }) : children}
        {hintNode}
      </div>
    );
  }

  return (
    <div id={id} role="group" aria-labelledby={`${baseId}-label`} aria-describedby={hintId}>
      <p id={`${baseId}-label`} className="label-field mb-1">
        {label}
      </p>
      {children}
      {hintNode}
    </div>
  );
}
