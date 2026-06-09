import { Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { getInitials } from "@/lib/stringUtils";
import {
  useGroupMatchingConfig,
  useMyGroupRegistration,
  usePostGroups,
  useRegistrationCount,
  useRegisterForMatching,
  useUnregisterFromMatching,
  type GroupMatchingGroup,
  type GroupMatchingMember,
} from "@/hooks/useGroupMatching";

function MemberAvatar({ member }: { member: GroupMatchingMember }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.learner_email.split("@")[0];
  const initials = getInitials(member.first_name ?? "", member.last_name ?? "", member.learner_email.slice(0, 2).toUpperCase());
  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold shrink-0 border-2"
      style={{ background: member.photo_url ? "transparent" : "var(--st-yellow)", color: "#101820", borderColor: "var(--st-white)" }}
      title={name}
    >
      {member.photo_url
        ? <img src={member.photo_url} alt={name} className="w-full h-full object-cover" />
        : initials}
    </div>
  );
}

function GroupRow({ group }: { group: GroupMatchingGroup }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {group.members.map((m) => (
          <MemberAvatar key={m.learner_email} member={m} />
        ))}
      </div>
      <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
        {group.members.map((m) => [m.first_name, m.last_name].filter(Boolean).join(" ") || m.learner_email.split("@")[0]).join(" · ")}
      </span>
    </div>
  );
}

export default function GroupMatchingBlock({
  postId,
  currentEmail,
}: {
  postId: string;
  currentEmail: string;
}) {
  const { data: config, isLoading: configLoading } = useGroupMatchingConfig(postId);
  const { data: myReg, isLoading: regLoading } = useMyGroupRegistration(postId, currentEmail);
  const { data: groups = [] } = usePostGroups(postId);
  const { data: counts } = useRegistrationCount(postId);
  const register = useRegisterForMatching(postId, currentEmail);
  const unregister = useUnregisterFromMatching(postId, currentEmail);
  const { toast } = useToast();

  if (configLoading || regLoading) return null;
  if (!config) return null;

  const myGroup = myReg?.status === "assigned"
    ? groups.find((g) => g.members.some((m) => m.learner_email === currentEmail))
    : null;

  const handleRegister = async () => {
    try {
      await register.mutateAsync();
      toast({ title: "Inscription enregistrée", description: "Tu seras mis(e) en relation prochainement." });
    } catch {
      toastError(toast, "Impossible de t'inscrire.");
    }
  };

  const handleUnregister = async () => {
    try {
      await unregister.mutateAsync();
      toast({ title: "Désinscription effectuée" });
    } catch {
      toastError(toast, "Impossible de te désinscrire.");
    }
  };

  return (
    <div
      className="mx-4 mt-1 mb-4 rounded-xl p-3 space-y-2.5"
      style={{ background: "rgba(255,209,0,0.08)", border: "1px solid rgba(255,209,0,0.3)" }}
    >
      <div className="flex items-center gap-2">
        <Users size={14} style={{ color: "var(--st-ink)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>
          Mise en relation — groupes de {config.group_size}
        </span>
        {counts && counts.total > 0 && (
          <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            · {counts.total} inscrit{counts.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Groupes formés */}
      {groups.length > 0 && (
        <div className="space-y-1.5">
          {groups.map((g) => <GroupRow key={g.id} group={g} />)}
        </div>
      )}

      {/* Mon statut */}
      {myGroup ? (
        <div className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
          Ton groupe ci-dessus — organisez-vous librement !
        </div>
      ) : myReg?.status === "assigned" ? (
        <div className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
          Tu es dans un groupe.
        </div>
      ) : myReg?.status === "pending" ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Inscrit(e) — mise en relation prochainement</span>
          <button
            onClick={handleUnregister}
            disabled={unregister.isPending}
            className="text-xs px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
          >
            {unregister.isPending ? <Loader2 size={12} className="animate-spin" /> : "Me désinscrire"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={register.isPending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:-translate-y-px"
          style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
        >
          {register.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Je suis partant(e)
        </button>
      )}
    </div>
  );
}
