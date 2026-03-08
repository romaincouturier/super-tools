import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  GraduationCap, Users, FileCheck, BarChart3, Calendar, Brain,
  CheckCircle2, ArrowRight, Star, Shield, Zap, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useTranslation } from "react-i18next";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  { icon: GraduationCap, title: "Gestion de formations", desc: "Créez, planifiez et suivez vos formations de A à Z." },
  { icon: Users, title: "Suivi des participants", desc: "Inscriptions, émargements, questionnaires et évaluations." },
  { icon: FileCheck, title: "Documents automatiques", desc: "Conventions, certificats, attestations générés en 1 clic." },
  { icon: BarChart3, title: "CRM intégré", desc: "Pipeline commercial, devis, relances automatiques." },
  { icon: Calendar, title: "Planning & missions", desc: "Agenda, missions, facturation et rentabilité." },
  { icon: Brain, title: "IA augmentée", desc: "Coach commercial, analyse d'évaluations, Arena IA." },
];

const plans = [
  {
    name: "Free", price: "0€", period: "/mois", highlight: false,
    features: ["1 formation active", "5 participants", "Émargements", "Questionnaires", "100 Mo stockage"],
  },
  {
    name: "Pro", price: "49€", period: "/mois", highlight: true,
    features: ["Formations illimitées", "Participants illimités", "CRM intégré", "IA augmentée", "5 Go stockage", "Support prioritaire"],
  },
  {
    name: "Business", price: "149€", period: "/mois", highlight: false,
    features: ["Tout Pro +", "Multi-utilisateurs", "White-label", "API publique", "50 Go stockage", "Account manager dédié"],
  },
];

const testimonials = [
  { name: "Marie L.", role: "Formatrice indépendante", text: "SuperTools m'a fait gagner 10h par semaine sur l'administratif. Je me concentre enfin sur la pédagogie.", stars: 5 },
  { name: "Thomas D.", role: "Organisme de formation", text: "Le CRM intégré + la gestion Qualiopi, c'est exactement ce qu'il manquait sur le marché.", stars: 5 },
  { name: "Sophie R.", role: "Coach & formatrice", text: "L'émargement digital et les certificats automatiques ont bluffé mes clients.", stars: 5 },
];

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-foreground text-secondary">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-foreground/95 backdrop-blur border-b border-border/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <SupertiltLogo className="h-8" variant="white" />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Tarifs</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Témoignages</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-secondary hover:text-primary" asChild>
              <Link to="/auth">Connexion</Link>
            </Button>
            <Button className="font-semibold" asChild>
              <Link to="/signup">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" /> Le Notion des formateurs
            </span>
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            Gérez tout votre business de{" "}
            <span className="text-primary">formation</span>{" "}
            depuis un seul outil
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            Formations, participants, émargements, évaluations, CRM, certificats, facturation — tout en un, conforme Qualiopi.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
          >
            <Button size="lg" className="text-lg px-8 py-6 font-bold" asChild>
              <Link to="/signup">
                Démarrer gratuitement <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-border/30 text-secondary hover:bg-secondary/10" asChild>
              <a href="#features">Découvrir</a>
            </Button>
          </motion.div>
          <motion.div
            className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground"
            initial="hidden" animate="visible" variants={fadeUp} custom={4}
          >
            <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-primary" /> Gratuit pour commencer</span>
            <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-primary" /> Conforme Qualiopi</span>
            <span className="flex items-center gap-1"><Globe className="w-4 h-4 text-primary" /> FR & EN</span>
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Tout ce dont un formateur a besoin</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Un seul outil remplace votre CRM, votre outil d'émargement, votre générateur de certificats et votre tableur Excel.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="bg-card/5 border-border/20 hover:border-primary/40 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-secondary">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24 px-6 bg-card/5">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Des tarifs simples et transparents</h2>
            <p className="text-muted-foreground text-lg">Commencez gratuitement, upgradez quand vous êtes prêt.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className={`h-full transition-all ${plan.highlight ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg shadow-primary/10" : "bg-card/5 border-border/20"}`}>
                  <CardContent className="p-8">
                    {plan.highlight && (
                      <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-4">Populaire</span>
                    )}
                    <h3 className="text-xl font-bold mb-1 text-secondary">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-black text-secondary">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button className={`w-full font-semibold ${plan.highlight ? "" : "variant-outline"}`} variant={plan.highlight ? "default" : "outline"} asChild>
                      <Link to="/signup">{plan.price === "0€" ? "Commencer" : "Essayer 14 jours"}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ils nous font confiance</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="bg-card/5 border-border/20 h-full">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.stars }).map((_, s) => (
                        <Star key={s} className="w-4 h-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                    <div>
                      <p className="font-semibold text-sm text-secondary">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-24 px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Prêt à simplifier votre activité ?</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">Rejoignez les formateurs qui gèrent tout depuis SuperTools.</p>
          <Button size="lg" className="text-lg px-10 py-6 font-bold" asChild>
            <Link to="/signup">Créer mon compte gratuitement <ArrowRight className="ml-2 w-5 h-5" /></Link>
          </Button>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/20 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <SupertiltLogo className="h-6" variant="white" />
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/politique-confidentialite" className="hover:text-primary transition-colors">Politique de confidentialité</Link>
            <a href="mailto:contact@supertilt.fr" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SuperTools. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
