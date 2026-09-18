import { Wrench } from "lucide-react";
import { useMaintenanceBanner } from "@/hooks/useMaintenanceBanner";

/**
 * Bandeau d'information des écrans de connexion, activable depuis les
 * paramètres généraux. Prévenir sur place vaut mieux qu'écrire à toute la base :
 * le message ne touche que les personnes qui se connectent, au moment où une
 * gêne peut survenir.
 */
export default function MaintenanceBanner() {
  const { data } = useMaintenanceBanner();
  if (!data?.enabled) return null;

  return (
    <div
      role="status"
      className="border-b border-[#f2dca0] bg-[#fdf6e4] px-5 py-3.5 sm:px-10"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <Wrench className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#1a2230]" />
        <div className="text-[14.5px] leading-6 text-[#1a2230]">
          <p className="font-semibold">On fait quelques travaux sur SuperTools</p>
          <p className="mt-0.5 text-[#6b7686]">{data.message}</p>
        </div>
      </div>
    </div>
  );
}
