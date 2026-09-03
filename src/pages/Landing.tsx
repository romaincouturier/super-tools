import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BookOpen, Check, Clock3, Compass, Gift, Layers3, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useAcademyCatalog, type AcademyCatalogCourse } from "@/hooks/useAcademyCatalog";
import { supabase } from "@/integrations/supabase/client";
import icebreakerModeEmploi from "@/assets/academy/icebreaker-mode-emploi.png.asset.json";
import icebreakerALaCarte from "@/assets/academy/icebreaker-a-la-carte.png.asset.json";
import postureManager from "@/assets/academy/posture-manager.png.asset.json";
import fondamentauxAgilite from "@/assets/academy/fondamentaux-agilite.png.asset.json";

/** Formations gratuites mises en avant sur la landing, avec leur miniature officielle. */
const FREE_COURSE_THUMBNAILS: Record<string, string> = {
  "f794d041-0794-4ced-b2e2-cd3fb7ac8287": icebreakerModeEmploi.url,
  "1a8efa6c-fddc-4e4c-9228-e67aff4083b0": icebreakerALaCarte.url,
  "2da412a9-4917-4306-9187-a2137b17700c": postureManager.url,
  "d20bf41f-6eeb-47b7-aab7-57def92d69ca": fondamentauxAgilite.url,
};
const FREE_COURSE_ORDER = Object.keys(FREE_COURSE_THUMBNAILS);

const expertise = [
  { label: "Facilitation graphique", text: "Structurer une idée, la rendre visible et la partager avec des mots simples et des dessins accessibles.", mark: "01" },
  { label: "Facilitation & intelligence collective", text: "Préparer et animer des temps de travail où chacun contribue et où le groupe avance vraiment.", mark: "02" },
  { label: "Gestion de projet", text: "Cadrer un projet, suivre son avancement et mieux communiquer avec les personnes impliquées.", mark: "03" },
];

const fallbackDescription = "Un parcours concret pour apprendre à votre rythme, avec des vidéos, des exercices et des ressources.";

function formatDuration(course: AcademyCatalogCourse) {
  const minutes = course.estimated_duration_minutes || ((course.formation_configs?.duree_heures ?? 0) * 60);
  if (!minutes) return null;
  return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

function CourseImage({ course, className = "", src }: { course: AcademyCatalogCourse; className?: string; src?: string }) {
  const url = src ?? course.cover_image_url;
  if (url) return <img src={url} alt={`Miniature de la formation ${course.title}`} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  return <div className={`flex h-full w-full items-center justify-center bg-secondary ${className}`}><BookOpen className="h-10 w-10 text-primary" strokeWidth={1.5} /></div>;
}

function FreeCourseCard({ course, index }: { course: AcademyCatalogCourse; index: number }) {
  return (
    <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ delay: index * 0.08, duration: 0.45 }} className="group flex h-full flex-col overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden"><CourseImage course={course} src={FREE_COURSE_THUMBNAILS[course.id]} className="transition-transform duration-500 group-hover:scale-[1.03]" /><span className="absolute left-4 top-4 inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground"><Gift className="h-3.5 w-3.5" /> Gratuit</span></div>
      <div className="flex flex-1 flex-col p-6"><h3 className="text-xl font-bold leading-tight text-foreground">{course.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{course.description || fallbackDescription}</p>{formatDuration(course) && <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /> {formatDuration(course)} de contenu</div>}<Button asChild className="mt-6 w-full font-bold"><Link to={`/academy/inscription?course=${encodeURIComponent(course.id)}`}>Commencer gratuitement <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    </motion.article>
  );
}

function PaidCourseCard({ course }: { course: AcademyCatalogCourse }) {
  const href = course.formation_configs?.supertilt_link;
  return <article className="group flex min-h-[370px] flex-col overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md"><div className="relative h-44 overflow-hidden"><CourseImage course={course} className="transition-transform duration-500 group-hover:scale-[1.03]" />{course.is_featured && <span className="absolute right-4 top-4 bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-background">À découvrir</span>}</div><div className="flex flex-1 flex-col p-6"><h3 className="text-xl font-bold leading-tight">{course.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{course.description || fallbackDescription}</p><div className="mt-6 flex items-center justify-between gap-4">{course.formation_configs?.prix != null && <span className="text-lg font-bold">{course.formation_configs.prix.toLocaleString("fr-FR")} €</span>}{href ? <Button asChild variant="outline" className="font-bold"><a href={href} target="_blank" rel="noreferrer">Découvrir la formation <ArrowRight className="ml-2 h-4 w-4" /></a></Button> : <span className="text-sm text-muted-foreground">Bientôt disponible</span>}</div></div></article>;
}

export default function Landing() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAcademyCatalog();
  const [menuOpen, setMenuOpen] = useState(false);
  const courses = data?.courses ?? [];
  const freeCourses = useMemo(() => FREE_COURSE_ORDER.map((id) => courses.find((course) => course.id === id)).filter((course): course is AcademyCatalogCourse => Boolean(course)), [courses]);
  const paidCourses = useMemo(() => courses.filter((course) => course.access_type === "payant" && course.is_featured).slice(0, 3), [courses]);

  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => { if (session) navigate("/espace-apprenant"); }); }, [navigate]);

  return <main className="min-h-screen bg-background text-foreground">
    <nav className="absolute inset-x-0 top-0 z-20"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10"><Link to="/" aria-label="Academy SuperTilt"><SupertiltLogo className="h-9" /></Link><div className="hidden items-center gap-8 md:flex"><a href="#formations" className="text-sm font-semibold hover:text-primary">Toutes les formations</a><Link to="/apprenant" className="text-sm font-semibold hover:text-primary">Se connecter</Link></div><button type="button" className="md:hidden" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button></div>{menuOpen && <div className="border-y border-border bg-background px-6 py-4 md:hidden"><div className="flex flex-col gap-4 text-sm font-semibold"><a href="#formations" onClick={() => setMenuOpen(false)}>Toutes les formations</a><Link to="/apprenant">Se connecter</Link></div></div>}</nav>

    <section className="relative overflow-hidden bg-primary px-6 pb-20 pt-32 lg:px-10 lg:pb-28 lg:pt-44"><div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border-[28px] border-primary-foreground/10 lg:h-96 lg:w-96" /><div className="pointer-events-none absolute bottom-[-180px] left-[8%] h-72 w-72 rounded-full border-[18px] border-primary-foreground/10" /><div className="relative mx-auto grid max-w-7xl items-end gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20"><div className="max-w-3xl"><p className="mb-7 text-sm font-bold uppercase tracking-[0.18em] text-primary-foreground/70">Academy SuperTilt</p><h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-tight text-primary-foreground sm:text-6xl lg:text-8xl">Apprenez, expérimentez, progressez avec SuperTilt.</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-primary-foreground/80 sm:text-xl">Des formations en ligne, des mini-cours et des ressources pour progresser en facilitation graphique, intelligence collective et gestion de projet. Et pour commencer, quatre formations sont accessibles gratuitement.</p><div className="mt-10 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-foreground px-7 font-bold text-background hover:bg-foreground/90"><a href="#formations">Commencer gratuitement <ArrowRight className="ml-2 h-5 w-5" /></a></Button></div></div><div className="hidden lg:block"><div className="border-l-2 border-primary-foreground/30 pl-8"><p className="text-6xl font-black text-primary-foreground">4</p><p className="mt-2 max-w-xs text-lg font-semibold leading-7 text-primary-foreground/80">formations gratuites pour découvrir l’Academy et passer à l’action.</p></div></div></div></section>

    <section id="formations" className="bg-background px-6 py-20 lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-primary">Pour commencer</p><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Commencez gratuitement</h2></div><p className="max-w-xl text-base leading-7 text-muted-foreground">Envie de tester l’Academy ? Commencez avec l’une de nos quatre formations gratuites. Créez simplement votre compte et lancez-vous.</p></div>{isLoading ? <div className="flex min-h-40 items-center justify-center"><Spinner size="lg" className="text-primary" /></div> : isError ? <p className="border border-border bg-secondary p-6 text-muted-foreground">Les formations seront bientôt disponibles.</p> : freeCourses.length > 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{freeCourses.map((course, index) => <FreeCourseCard key={course.id} course={course} index={index} />)}</div> : <p className="text-muted-foreground">Aucune formation gratuite n’est disponible pour le moment.</p>}</div></section>

    <section id="expertises" className="bg-secondary px-6 py-20 lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-12 flex items-end justify-between gap-8"><h2 className="text-4xl font-black tracking-tight sm:text-5xl">LES EXPERTISES DE L'ACADEMY SUPERTILT</h2><Compass className="hidden h-14 w-14 text-primary md:block" strokeWidth={1.5} /></div><div className="grid border-t border-border md:grid-cols-3">{expertise.map((item) => <article key={item.label} className="border-b border-border py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"><span className="text-sm font-black text-primary">{item.mark}</span><h3 className="mt-10 text-2xl font-bold leading-tight">{item.label}</h3><p className="mt-4 text-base leading-7 text-muted-foreground">{item.text}</p></article>)}</div></div></section>

    <section className="bg-foreground px-6 py-20 text-background lg:px-10 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_1.5fr] md:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Une façon simple d’apprendre</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Du concret, à votre rythme.</h2></div><div className="grid gap-5 sm:grid-cols-3">{[{ icon: BookOpen, text: "Des contenus courts et accessibles" }, { icon: Layers3, text: "Des exercices pour pratiquer" }, { icon: Check, text: "Des ressources à garder" }].map(({ icon: Icon, text }) => <div key={text} className="border-l border-background/20 pl-5"><Icon className="h-6 w-6 text-primary" /><p className="mt-4 text-sm font-semibold leading-6 text-background/75">{text}</p></div>)}</div></div></section>

    {paidCourses.length > 0 && <section className="bg-background px-6 py-20 lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-primary">Pour aller plus loin</p><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Aller plus loin</h2></div><p className="max-w-xl text-base leading-7 text-muted-foreground">Vous voulez approfondir ? Découvrez une sélection de nos formations en ligne.</p></div><div className="grid gap-6 md:grid-cols-3">{paidCourses.map((course) => <PaidCourseCard key={course.id} course={course} />)}</div></div></section>}

    <section className="bg-secondary px-6 py-20 lg:px-10 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-center"><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Et au-delà de l’Academy ?</h2><div><p className="max-w-2xl text-lg leading-8 text-muted-foreground">Nous proposons aussi des formations en présentiel et accompagnons les équipes directement sur le terrain : coaching, facilitation d’ateliers et de séminaires, scribing…</p><a href="https://supertilt.fr" target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center font-bold underline decoration-primary decoration-2 underline-offset-4">Découvrir SuperTilt <ArrowRight className="ml-2 h-5 w-5" /></a></div></div></section>

    <section className="bg-primary px-6 py-20 lg:px-10 lg:py-24"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-primary-foreground/70">À vous de jouer</p><h2 className="mt-4 text-4xl font-black tracking-tight text-primary-foreground sm:text-6xl">Envie de commencer ?</h2><p className="mt-5 max-w-xl text-lg leading-8 text-primary-foreground/80">Choisissez une formation gratuite, créez votre compte et c’est parti.</p></div><Button asChild size="lg" className="bg-foreground px-7 font-bold text-background hover:bg-foreground/90"><a href="#formations">Voir les formations <ArrowRight className="ml-2 h-5 w-5" /></a></Button></div></section>

    <footer className="bg-foreground px-6 py-10 text-background lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between"><SupertiltLogo className="h-7" invert /><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-background/60"><Link to="/politique-confidentialite" className="hover:text-primary">Politique de confidentialité</Link><a href="mailto:contact@supertilt.fr" className="hover:text-primary">Contact</a><span>© {new Date().getFullYear()} SuperTilt</span></div></div></footer>
  </main>;
}
