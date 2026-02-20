import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PolitiqueConfidentialite = () => {
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");

  useEffect(() => {
    (supabase.rpc as any)("get_public_contact").then(({ data }: any) => {
      if (data && data.length > 0) {
        setContactEmail(data[0].email || "");
        setContactName(data[0].name || "");
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Politique de confidentialité</CardTitle>
            <p className="text-sm text-muted-foreground">Dernière mise à jour : Janvier 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
              <p className="text-muted-foreground">
                SuperTilt, représenté par Romain Couturier, est responsable du traitement des données personnelles
                collectées dans le cadre de ses activités de formation professionnelle.
              </p>
              <p className="text-muted-foreground">
                <strong>Contact :</strong> {contactEmail}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Données collectées</h2>
              <p className="text-muted-foreground">
                Dans le cadre du questionnaire de recueil des besoins, nous collectons les données suivantes :
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Nom, prénom, email, société, fonction</li>
                <li>Expérience professionnelle sur le sujet de la formation</li>
                <li>Niveau d'auto-évaluation et objectifs de formation</li>
                <li>Besoins d'accessibilité et aménagements spécifiques</li>
                <li>Validation des prérequis</li>
                <li>Contraintes organisationnelles</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Finalités du traitement</h2>
              <p className="text-muted-foreground">Vos données sont utilisées exclusivement pour :</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Adapter le contenu de la formation à vos besoins spécifiques</li>
                <li>Évaluer le positionnement initial des participants (exigence Qualiopi)</li>
                <li>Mettre en place les aménagements nécessaires (accessibilité)</li>
                <li>Améliorer la qualité de nos formations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Base légale</h2>
              <p className="text-muted-foreground">
                Le traitement de vos données repose sur votre consentement explicite, recueilli via le questionnaire
                de recueil des besoins.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Durée de conservation</h2>
              <p className="text-muted-foreground">
                Conformément aux exigences de la certification Qualiopi, vos données sont conservées pendant une
                durée de <strong>3 ans</strong> à compter de la date de la formation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Destinataires des données</h2>
              <p className="text-muted-foreground">
                Vos données sont exclusivement accessibles à l'équipe pédagogique de SuperTilt. Elles ne sont
                <strong> jamais communiquées à des tiers</strong>, ni à des fins commerciales, ni à d'autres fins.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Sécurité des données</h2>
              <p className="text-muted-foreground">
                Nous mettons en œuvre toutes les mesures techniques et organisationnelles appropriées pour protéger
                vos données contre tout accès non autorisé, modification, divulgation ou destruction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Vos droits</h2>
              <p className="text-muted-foreground">
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits
                suivants :
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
                <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
                <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données</li>
                <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
                <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données</li>
                <li><strong>Droit de retirer votre consentement</strong> à tout moment</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Pour exercer ces droits, contactez-nous à :{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Référent handicap</h2>
              <p className="text-muted-foreground">
                Pour toute question relative à l'accessibilité de nos formations, vous pouvez contacter notre
                référent handicap :
              </p>
              <p className="text-muted-foreground">
                <strong>{contactName}</strong> -{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Réclamations</h2>
              <p className="text-muted-foreground">
                Si vous estimez que le traitement de vos données ne respecte pas la réglementation applicable, vous
                pouvez introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des
                Libertés) :{" "}
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.cnil.fr
                </a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PolitiqueConfidentialite;
