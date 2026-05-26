import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Clock, BookOpen, Sparkles, Target, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SupertiltLogo from "@/components/SupertiltLogo";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

interface ModuleRow { id: string; title: string; position: number; course_id: string }
interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  estimated_duration_minutes: number | null;
  modules: ModuleRow[];
  boutique_url: string | null;
  prix: number | null;
  duree_heures: number | null;
}

const audience = [
  { icon: Users, title: "Formateurs & coachs", desc: "Donnez plus d'impact à vos interventions avec le visuel." },
  { icon: Target, title: "Facilitateurs", desc: "Modélisez les conversations et idées sur le vif." },
  { icon: Sparkles, title: "Toute personne créative", desc: "Aucun prérequis en dessin. Juste l'envie d'essayer." },
];

export default function Landing() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const [coursesRes, modulesRes, configsRes] = await Promise.all([
        (supabase as any)
          .from("lms_courses")
          .select("id, title, description, cover_image_url, estimated_duration_minutes")
          .eq("status", "published")
          .order("created_at", { ascending: true }),
        (supabase as any).from("lms_modules").select("id, title, position, course_id").order("position", { ascending: true }),
        (supabase as any).from("formation_configs").select("formation_name, supertilt_link, prix, duree_heures").not("supertilt_link", "is", null),
      ]);

      const allModules: ModuleRow[] = modulesRes.data || [];
      const configs: Array<{ formation_name: string; supertilt_link: string; prix: number | null; duree_heures: number | null }> = configsRes.data || [];

      const matchConfig = (title: string) => {
        const t = title.toLowerCase();
        return configs.find((c) => {
          const n = (c.formation_name || "").toLowerCase();
          return n.includes(t) || t.includes(n) || n.split(" ").filter((w) => w.length > 4).some((w) => t.includes(w));
        });
      };

      const enriched: CourseRow[] = (coursesRes.data || []).map((c: any) => {
        const cfg = matchConfig(c.title);
        return {
          ...c,
          modules: allModules.filter((m) => m.course_id === c.id),
          boutique_url: cfg?.supertilt_link ?? null,
          prix: cfg?.prix ?? null,
          duree_heures: cfg?.duree_heures ?? null,
        };
      });
      setCourses(enriched);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-foreground text-secondary">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-foreground/95 backdrop-blur border-b border-border/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <SupertiltLogo className="h-8" invert />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#formations" className="hover:text-primary transition-colors">Formations</a>
            <a href="#audience" className="hover:text-primary transition-colors">Pour qui</a>
          </div>
          <Button variant="ghost" className="text-secondary hover:text-primary" asChild>
            <Link to="/auth">Connexion</Link>
          </Button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> Apprentissage en ligne · 100 % à votre rythme
            </span>
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            Faites parler vos idées,{" "}
            <span className="text-primary">en images</span>.
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            Découvrez nos formations e-learning dédiées à la facilitation graphique et à la communication visuelle. Vidéos, exercices guidés, communauté d'apprenants.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
          >
            <Button size="lg" className="text-base px-8 py-6 font-bold" asChild>
              <a href="#formations">
                Voir les formations <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ─── AUDIENCE ─── */}
      <section id="audience" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pour qui ?</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Que vous animiez, formiez ou facilitiez, le visuel est un levier d'impact.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {audience.map((a, i) => (
              <motion.div key={a.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <div className="bg-card/5 border border-border/20 rounded-2xl p-6 h-full hover:border-primary/40 transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <a.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-secondary">{a.title}</h3>
                  <p className="text-muted-foreground text-sm">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FORMATIONS ─── */}
      <section id="formations" className="py-20 px-6 bg-card/5">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Les formations disponibles</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Des parcours structurés, vidéo + pratique, avec retour personnalisé.
            </p>
          </motion.div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Chargement…</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {courses.map((c, i) => (
                <motion.article
                  key={c.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  className="bg-background/30 border border-border/20 rounded-3xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors"
                >
                  {c.cover_image_url ? (
                    <img src={c.cover_image_url} alt={c.title} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-primary/40" />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-2xl font-bold mb-2">{c.title}</h3>
                    {c.description && (
                      <p className="text-muted-foreground text-sm mb-4">{c.description}</p>
                    )}

                    {/* Méta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-5">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        {c.modules.length} module{c.modules.length > 1 ? "s" : ""}
                      </span>
                      {c.duree_heures && c.duree_heures > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {c.duree_heures} h
                        </span>
                      )}
                    </div>

                    {/* Programme */}
                    {c.modules.length > 0 && (
                      <div className="mb-6">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-semibold">Programme</p>
                        <ul className="space-y-2">
                          {c.modules.map((m) => (
                            <li key={m.id} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <span>{m.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="mt-auto pt-4 flex items-end justify-between gap-4">
                      <div>
                        {c.prix != null && (
                          <p className="text-2xl font-black">
                            {c.prix === 0 ? "Gratuit" : `${c.prix.toLocaleString("fr-FR")} €`}
                          </p>
                        )}
                      </div>
                      {c.boutique_url ? (
                        <Button asChild className="font-semibold">
                          <a href={c.boutique_url} target="_blank" rel="noreferrer">
                            S'inscrire <ArrowRight className="ml-1.5 w-4 h-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="font-semibold border-border/30">
                          Bientôt disponible
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
              {courses.length === 0 && (
                <p className="text-center text-muted-foreground col-span-full py-12">
                  Aucune formation publiée pour le moment.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/20 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <SupertiltLogo className="h-6" invert />
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/politique-confidentialite" className="hover:text-primary transition-colors">Politique de confidentialité</Link>
            <a href="mailto:contact@supertilt.fr" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Supertilt. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
