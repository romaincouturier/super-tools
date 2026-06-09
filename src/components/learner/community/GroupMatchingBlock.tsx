import { Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { getInitials } from "@/lib/stringUtils";
import {
  useGroupMatchingConfig,
  useMyGroupRegistration,
  usePostGroups,
  usePendingRegistrationProfiles,
  useRegisterForMatching,
  useUnregisterFromMatching,
  type GroupMatchingGroup,
  type GroupMatchingMember,
} from "@/hooks/useGroupMatching";

function MemberAvatar({ member, size = 7 }: { member: GroupMatchingMember; size?: number }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.learner_email.split("@")[0];
  const initials = getInitials(member.first_name ?? "", member.last_name ?? "", member.learner_email.slice(0, 2).toUpperCase());
  const px = size * 4;
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0 border-2"
      style={{ width: px, height: px, fontSize: px * 0.35, background: member.photo_url ? "transparent" : "var(--st-yellow)", color: "#101820", borderColor: "var(--st-white)" }}
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

function groupNoun(size: number): string {
  if (size === 2) return "binôme";
  if (size === 3) return "trinôme";
  return "groupe";
}

function PendingAvatars({ profiles, groupSize }: { profiles: GroupMatchingMember[]; groupSize: number }) {
  if (!profiles.length) return null;
  const noun = groupNoun(groupSize);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {profiles.slice(0, 6).map((m) => (
          <MemberAvatar key={m.learner_email} member={m} size={8} />
        ))}
        {profiles.length > 6 && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
            style={{ background: "rgba(16,24,32,0.08)", color: "var(--st-ink-muted)", borderColor: "var(--st-white)" }}
          >
            +{profiles.length - 6}
          </div>
        )}
      </div>
      <p className="text-xs font-medium" style={{ color: "var(--st-ink)" }}>
        D'autres participant(e)s sont déjà partant(e)s pour former un {noun}, rejoins-les pour enrichir ton expérience de formation
      </p>
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
  const { data: pendingProfiles = [] } = usePendingRegistrationProfiles(postId);
  const register = useRegisterForMatching(postId, currentEmail);
  const unregister = useUnregisterFromMatching(postId, currentEmail);
  const { toast } = useToast();

  if (configLoading || regLoading) return null;
  if (!config) return null;

  const myGroup = myReg?.status === "assigned"
    ? groups.find((g) => g.members.some((m) => m.learner_email === currentEmail))
    : null;

  const isNotRegistered = !myReg;

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
    <div className="px-4 pt-2 pb-6">
      <div
        className="rounded-xl p-3 space-y-3"
        style={{ background: "rgba(255,209,0,0.08)", border: "1px solid rgba(255,209,0,0.3)" }}
      >
      <div className="flex items-center gap-2">
        <Users size={14} style={{ color: "var(--st-ink)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--st-ink)" }}>
          Trouver un binôme
        </span>
      </div>

      {/* Groupes déjà formés */}
      {groups.length > 0 && (
        <div className="space-y-1.5">
          {groups.map((g) => <GroupRow key={g.id} group={g} />)}
        </div>
      )}

      {/* Inscrits en attente — avatars + progression (visible si pas encore inscrit) */}
      {isNotRegistered && (
        <PendingAvatars profiles={pendingProfiles} />
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
        <div className="space-y-2">
          <PendingAvatars profiles={pendingProfiles} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Tu es inscrit(e) — mise en relation prochainement</span>
            <button
              onClick={handleUnregister}
              disabled={unregister.isPending}
              className="text-xs px-2 py-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
              style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}
            >
              {unregister.isPending ? <Loader2 size={12} className="animate-spin" /> : "Me désinscrire"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={register.isPending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:-translate-y-px"
          style={{ background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" }}
        >
          {register.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Je veux un binôme
        </button>
      )}
      </div>
    </div>
  );
}
