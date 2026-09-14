import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Champ de saisie des écrans de connexion, au gabarit de la maquette. */
export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  icon,
  autoFocus,
  readOnly,
  required,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  icon?: ReactNode;
  autoFocus?: boolean;
  readOnly?: boolean;
  required?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  return (
    <div className="mb-5 text-left">
      <label htmlFor={id} className="mb-2.5 block text-[14.5px] font-bold">
        {label}
      </label>
      <div className="flex h-[54px] items-center gap-3 rounded-[11px] border border-[#e3e6ea] bg-white px-4 focus-within:border-[#fdc500] focus-within:shadow-[0_0_0_3px_rgba(253,197,0,.16)]">
        {icon && <span className="shrink-0 text-[#9aa3b0]">{icon}</span>}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          readOnly={readOnly}
          required={required}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15.5px] text-[#1a2230] outline-none placeholder:text-[#9aa3b0]"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="flex rounded-md p-1.5 text-[#9aa3b0] hover:text-[#1a2230]"
          >
            {revealed ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
    </div>
  );
}

/** Bouton principal jaune, pleine largeur. */
export function AuthButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-[11px] bg-[#fdc500] text-base font-semibold text-[#1a2230] transition-colors hover:bg-[#ffd100] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
