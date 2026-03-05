const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 py-4 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>&copy; {currentYear} SuperTools. Tous droits réservés.</p>
        <div className="flex items-center gap-4">
          <a href="/politique-confidentialite" className="hover:underline">
            Politique de confidentialité
          </a>
          <span>|</span>
          <span>Mentions légales</span>
          <span>|</span>
          <span>CGU</span>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
