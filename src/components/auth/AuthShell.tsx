import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import MaintenanceBanner from "@/components/auth/MaintenanceBanner";

/**
 * Coquille commune aux écrans de connexion (maquette SuperTilt).
 * Fond clair, en-tête blanc avec logo et lien de retour, carte centrée.
 */
export function AuthShell({
  children,
  backHref = "https://supertilt.fr",
  backLabel = "Retour au site SuperTilt",
  onBack,
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f7] text-[#1a2230]">
      <header className="flex flex-wrap items-center gap-5 border-b border-[#eceef1] bg-white px-5 py-4 sm:px-10">
        <SupertiltLogo className="h-7 sm:h-8" />
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="ml-auto flex items-center gap-2.5 text-[15px] text-[#1a2230] hover:text-black"
          >
            <ArrowLeft className="h-[19px] w-[19px]" />
            {backLabel}
          </button>
        ) : (
          <a
            href={backHref}
            className="ml-auto flex items-center gap-2.5 text-[15px] text-[#1a2230] hover:text-black"
          >
            <ArrowLeft className="h-[19px] w-[19px]" />
            {backLabel}
          </a>
        )}
      </header>
      <MaintenanceBanner />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-14 pt-11 sm:px-6">
        <Blobs />
        {children}
      </main>
    </div>
  );
}

/** Carte simple, écran de connexion. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-[660px] rounded-[22px] bg-white px-7 pb-10 pt-12 text-center shadow-[0_1px_2px_rgba(26,34,48,.04),0_12px_40px_rgba(26,34,48,.06)] sm:px-16 sm:pt-14">
      {children}
    </div>
  );
}

/** Carte deux colonnes : formulaire à gauche, panneau d'aide à droite. */
export function AuthSplitCard({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="relative z-10 grid w-full max-w-[1240px] grid-cols-1 rounded-[22px] bg-white shadow-[0_1px_2px_rgba(26,34,48,.04),0_12px_40px_rgba(26,34,48,.06)] lg:grid-cols-[1fr_1px_1fr]">
      <div className="px-8 pb-10 pt-12 sm:px-14">{left}</div>
      <div className="hidden bg-[#eceef1] lg:block" />
      <div className="flex flex-col gap-8 border-t border-[#eceef1] px-8 pb-11 pt-10 sm:px-14 lg:border-t-0">
        {right}
      </div>
    </div>
  );
}

/** Pastille ronde crème portant une icône. */
export function AuthBadge({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#fdf6e4] text-[#1a2230]">
      {children}
    </div>
  );
}

/** Panneau d'aide de droite : une liste d'items icône + texte. */
export function AuthInfoPanel({
  items,
}: {
  items: { icon: ReactNode; title: string; text: string }[];
}) {
  return (
    <div className="rounded-2xl bg-[#fdf8ec] px-6 py-1.5">
      {items.map((item, index) => (
        <div
          key={item.title}
          className={`flex gap-4 py-6 ${index > 0 ? "border-t border-[rgba(26,34,48,.07)]" : ""}`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fdf6e4] text-[#1a2230]">
            {item.icon}
          </div>
          <div>
            <h3 className="mb-1 text-[15.5px] font-semibold">{item.title}</h3>
            <p className="text-[14.5px] leading-6 text-[#6b7686]">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Titre d'écran de connexion. Un seul jeu de classes : les dix titres du
 * parcours avaient dérivé sur trois variantes à un ou deux pixels d'écart,
 * y compris entre deux écrans du même fichier.
 */
export function AuthTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-2.5 text-[26px] font-semibold leading-tight tracking-[-0.7px] sm:text-[31px]">
      {children}
    </h1>
  );
}

/** Pied d'écran : contact support, présent sur tous les écrans de connexion. */
export function AuthSupportLine() {
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-[#eceef1] pt-6 text-[14.5px] text-[#6b7686]">
      Besoin d'aide ? Écrivez-nous à{" "}
      <a href="mailto:contact@supertilt.fr" className="underline underline-offset-[3px]">
        contact@supertilt.fr
      </a>
    </div>
  );
}

function Blobs() {
  return (
    <>
      <svg
        className="pointer-events-none absolute left-[-60px] top-1/2 z-0 hidden w-[420px] -translate-y-1/2 md:block"
        viewBox="0 0 420 380"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M300 40c58 34 84 118 58 190-26 72-104 132-176 126S46 268 40 196C34 124 82 48 156 26s86-20 144 14z"
          fill="#fdf3dc"
        />
        <path
          d="M118 262c-28-16-44-44-30-70 14-26 52-24 62 2 10 26-18 44-36 36-18-8-16-38 8-46 30-10 58 14 62 44"
          stroke="#c9ced4"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="pointer-events-none absolute right-[-40px] top-1/2 z-0 hidden w-[560px] -translate-y-[46%] md:block"
        viewBox="0 0 560 420"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M300 30c78 0 150 60 168 140s-24 170-100 202-176 8-222-56S130 156 186 88 222 30 300 30z"
          fill="#fbf7f0"
        />
        <g stroke="#cfd4da" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="150" y="70" width="210" height="140" rx="7" />
          <path d="M255 210v22M215 236h80" />
          <rect x="300" y="130" width="130" height="180" rx="12" fill="#fff" />
          <path d="M318 168h34M318 196h34M318 224h34" />
          <path d="M356 166l5 6 8-10M356 194l5 6 8-10M356 222l5 6 8-10" stroke="#fdc500" strokeWidth="2.2" />
          <circle cx="60" cy="176" r="34" fill="#fff" />
          <path d="M52 164l20 12-20 12z" fill="#fdc500" stroke="none" />
        </g>
      </svg>
    </>
  );
}
