import type { LegalDocument } from "./legal";
import { SITE } from "@/lib/config/site";

/**
 * French Terms of Service and Privacy Policy.
 *
 * A complete parallel document rather than a per-field overlay: a legal text is
 * only sound as a whole, and a French page with English clauses left in would
 * misstate the terms. Written as French originals, as the brand-voice guidance
 * for this project asks, rather than as a literal translation of the English.
 *
 * The clause anchors (`id`) are deliberately identical to the English document's,
 * so a deep link such as `/en/privacy#retention` keeps working after a switch to
 * French instead of landing at the top of the page.
 *
 * Facts match the English text and the codebase: the account fields, the three
 * payment methods, the salted IP hash, and the retention commitments supplied
 * for this phase.
 */

const CONTACT_EMAIL = SITE.email;
const CONTACT_PHONE = SITE.phones[0]!;
const POSTAL_ADDRESS = `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.region}, ${SITE.address.country}`;

const LAST_UPDATED = "24 septembre 2026";
/** The same revision as `SITE_REVISION_DATE`, in the form a crawler reads. */
const LAST_UPDATED_ISO = "2026-09-24";

const CONDITIONS: LegalDocument = {
  title: "Conditions d'utilisation",
  description:
    "Les conditions qui régissent l'utilisation du site de KC Technology Corporation, les commandes passées sur notre boutique en ligne, les comptes et nos services.",
  intro:
    "Les conditions selon lesquelles nous proposons ce site et les services que vous pouvez y commander. Rédigées pour être lues, non pour obscurcir les choses — si un point reste peu clair, contactez-nous et nous l'expliquerons.",
  updatedAt: LAST_UPDATED,
  updatedAtIso: LAST_UPDATED_ISO,
  sections: [
    {
      id: "agreement",
      heading: "Acceptation de ces conditions",
      body: `Ces conditions régissent votre utilisation du site de KC Technology Corporation ainsi que toute commande, demande de renseignements ou création de compte effectuée par son intermédiaire. Le site est exploité par ${SITE.legalName} (« KC Technology », « nous »), dont le siège social se trouve à ${POSTAL_ADDRESS}.

En utilisant le site, vous acceptez ces conditions. Si vous ne les acceptez pas, veuillez ne pas utiliser le site. Lorsqu'une commande ou une prestation fait l'objet d'un contrat écrit distinct, ce contrat régit la prestation et les présentes conditions régissent le site lui-même.`,
    },
    {
      id: "about-us",
      heading: "Qui nous sommes et comment nous joindre",
      body: `Nous exploitons les départements Marketing Digital, Services Électriques et Immobilier depuis notre siège social à ${SITE.address.city}, ${SITE.address.country}, et nous servons des clients dans tout le pays.

Pour toute question relative aux présentes conditions, à une commande ou à un projet, contactez-nous à ${CONTACT_EMAIL} ou au ${CONTACT_PHONE}, ou par courrier à ${POSTAL_ADDRESS}.`,
    },
    {
      id: "services-and-scope",
      heading: "Nos services et l'étendue des prestations",
      body: `**Marketing Digital.** Vitrine, campagnes et produits technologiques. Les commandes passées sur notre boutique en ligne sont régies par les sections relatives aux commandes et au paiement ci-dessous.

**Services Électriques.** Ingénierie électrique, installation, maintenance et travaux d'infrastructure. Ces travaux sont définis, chiffrés et réalisés dans le cadre d'un devis écrit distinct. Rien sur ce site ne constitue une offre d'exécuter des travaux électriques réglementés, et aucun travail ne commence avant l'accord sur un devis.

**Immobilier.** Annonces immobilières et mises en relation à travers le Cameroun. Une annonce décrit un bien tel que déclaré par le vendeur ou nos agents. Elle ne constitue pas une garantie de titre, d'état, de superficie, de prix ou de disponibilité, et ne remplace ni votre propre inspection et vérification juridique, ni la vérification du titre auprès du registre foncier.

Tout chiffre, délai ou description publié sur le site est indicatif jusqu'à sa confirmation dans un devis écrit ou un mandat de mise en vente.`,
    },
    {
      id: "accounts",
      heading: "Votre compte",
      body: `Vous pouvez créer un compte pour passer des commandes, enregistrer des biens et suivre vos demandes. La création d'un compte requiert votre nom complet, votre adresse e-mail et un mot de passe d'au moins huit caractères. Vous devez confirmer votre adresse e-mail avant de pouvoir vous connecter.

Il vous incombe de préserver la confidentialité de votre mot de passe et l'accès à votre messagerie, ainsi que l'activité effectuée sous votre compte. Les mots de passe sont conservés par notre prestataire d'authentification, jamais en clair et jamais sous une forme que nous pouvons lire. Informez-nous rapidement à ${CONTACT_EMAIL} si vous pensez que quelqu'un d'autre a accédé à votre compte.`,
    },
    {
      id: "orders-payments",
      heading: "Commandes et paiement",
      body: `**Passer commande.** Une commande est passée lorsque vous soumettez le formulaire de paiement et que vous payez. Les prix sont affichés en francs CFA d'Afrique centrale (XAF), seule devise dans laquelle notre prestataire de paiement opère.

**Moyens de paiement.** Le paiement est traité par Fapshi, prestataire de paiement camerounais. Les moyens disponibles sont MTN Mobile Money, Orange Money et le virement bancaire. Nous n'acceptons pas les paiements par carte. Vous effectuez le paiement sur la page hébergée de Fapshi ; les données de carte et de mobile money y sont saisies et ne sont jamais transmises à ce site ni conservées par lui.

**Confirmation.** Une commande n'est confirmée qu'après vérification, directement auprès de Fapshi, que le paiement a réussi et que le montant et la devise correspondent à la commande. Un paiement signalé comme réussi mais ne correspondant pas à la commande n'est pas considéré comme réglé.

**Livraison et retrait.** Les commandes peuvent être retirées à notre bureau de ${SITE.address.city} ou livrées à l'adresse que vous indiquez au paiement. Une commande en livraison exige une adresse et une ville. Les frais de livraison, lorsqu'ils s'appliquent, sont affichés et acceptés au moment du paiement, et une commande est désignée comme commande en livraison ou comme commande en retrait, tant au paiement que sur le reçu.`,
    },
    {
      id: "inquiries",
      heading: "Devis et informations précontractuelles",
      body: `Un devis que nous émettons constitue une invitation à contracter, non une offre ferme, sauf mention contraire et signature des deux parties. Un devis repose sur les informations disponibles à ce moment, y compris les photographies et les mesures que vous fournissez ; une visite sur site peut le modifier.

Lorsque vous fournissez des mesures, photographies, plans ou documents en vue d'un devis, vous confirmez être autorisé à les transmettre et qu'ils sont exacts au meilleur de votre connaissance.`,
    },
    {
      id: "cancellation",
      heading: "Annulation, retours et remboursements",
      body: `**Annuler une commande.** Contactez-nous à ${CONTACT_EMAIL} dès que possible. Lorsqu'une commande n'a pas encore été expédiée ni installée, nous l'annulons et remboursons les sommes déjà versées.

**Retours et remboursements.** Les biens sont retournables s'ils sont défectueux, non conformes à la description ou inadaptés à l'usage convenu. Les biens et matériels électriques installés, modifiés ou utilisés ne sont pas retournables, sauf s'ils sont défectueux. Les remboursements approuvés sont effectués par le même canal de paiement que celui utilisé pour le règlement, via notre prestataire de paiement.

**Prestations en cours.** Lorsqu'une installation ou une campagne a commencé, la part déjà exécutée est due et est déduite de tout remboursement.

**Droits légaux.** Aucune disposition de cette section ne limite les droits dont vous disposez en vertu du droit camerounais applicable, y compris les dispositions de protection du consommateur de la loi n° 2011/012.`,
    },
    {
      id: "consumer-rights",
      heading: "Protection du consommateur",
      body: `Si vous traitez avec nous en tant que consommateur, vous bénéficiez de la protection du droit camerounais de la consommation, en particulier la loi n° 2011/012 du 6 mai 2011 portant protection du consommateur au Cameroun. Rien sur ce site, et rien de ce que nous convenons séparément, ne supprime ni ne réduit ces droits.

Si un problème survient avec une commande ou une prestation, informez-nous d'abord à ${CONTACT_EMAIL} ou au ${CONTACT_PHONE} afin que nous puissions le corriger.`,
    },
    {
      id: "acceptable-use",
      heading: "Utilisation acceptable du site",
      body: `Vous ne devez pas :

1. copier, extraire ou republier le site ou son contenu au-delà de ce que ces conditions autorisent ;
2. tenter d'accéder à une partie du site ou de nos systèmes que vous n'êtes pas autorisé à utiliser ;
3. soumettre des contenus faux, trompeurs ou illicites, notamment par une demande de renseignements ou un avis ;
4. perturber le fonctionnement du site, y compris en tentant de le surcharger ;
5. utiliser ce site à des fins illicites.

Nous pouvons suspendre ou fermer un compte, et refuser ou annuler une commande, lorsque ces conditions sont violées ou lorsque la loi nous y oblige.`,
    },
    {
      id: "ip",
      heading: "Propriété intellectuelle",
      body: `La conception, les textes, le code, les images, la marque et les logos du site appartiennent à ${SITE.legalName} ou sont utilisés avec autorisation. Vous pouvez lire, imprimer et partager les pages pour votre usage personnel ou interne à votre entreprise. Toute utilisation au-delà — republication, rediffusion, ou usage de nos contenus pour entraîner ou alimenter un service concurrent — requiert notre autorisation écrite préalable.

Les contenus que vous nous transmettez — photographies, documents, éléments de marque ou textes de campagne — restent les vôtres. En nous les transmettant, vous nous autorisez à les utiliser pour la finalité pour laquelle ils ont été envoyés, qu'il s'agisse d'un devis, d'une commande ou d'un projet.`,
    },
    {
      id: "availability",
      heading: "Disponibilité et exactitude du site",
      body: `Nous nous efforçons de maintenir le site exact et disponible, mais nous ne pouvons garantir qu'il sera exempt d'interruptions ou d'erreurs. Les annonces, les prix, les stocks et la disponibilité des services évoluent et peuvent être périmés entre deux publications.

Nous pouvons modifier, suspendre ou retirer toute partie du site à tout moment.`,
    },
    {
      id: "liability",
      heading: "Notre responsabilité envers vous",
      body: `Nous sommes responsables des pertes que vous subissez et qui résultent de manière prévisible de notre manquement aux présentes conditions ou de notre défaut de diligence et de compétence raisonnables. Nous ne sommes pas responsables des pertes imprévisibles, des pertes commerciales telles que la perte de bénéfice ou d'opportunité lorsque le site est utilisé dans le cadre d'une activité professionnelle, ni des pertes résultant de circonstances échappant à notre contrôle raisonnable.

Aucune disposition des présentes conditions ne limite notre responsabilité en cas de décès ou de dommage corporel causé par notre négligence, en cas de fraude, ni dans tout autre cas où la limitation serait illicite.`,
    },
    {
      id: "privacy-reference",
      heading: "Vos données",
      body: `La manière dont nous traitons les données personnelles — ce que nous collectons, pourquoi, combien de temps nous les conservons et les choix dont vous disposez — est exposée dans notre [Politique de confidentialité](/fr/privacy). Elle fait partie intégrante des présentes conditions.`,
    },
    {
      id: "general",
      heading: "Modification des conditions et droit applicable",
      body: `Nous pouvons mettre à jour ces conditions pour tenir compte de l'évolution du site ou du droit. La version publiée sur cette page au moment où vous utilisez le site est celle qui s'applique, et la date en tête de page indique sa dernière modification.

Ces conditions sont régies par le droit camerounais, et les tribunaux camerounais sont compétents pour tout litige qui en découle. Si une disposition est jugée inapplicable, les autres demeurent en vigueur.`,
    },
  ],
};

const CONFIDENTIALITE: LegalDocument = {
  title: "Politique de confidentialité",
  description:
    "Quelles données personnelles KC Technology Corporation collecte via ce site, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et les choix dont vous disposez.",
  intro:
    "Cette notice décrit exactement ce que ce site collecte, pourquoi, et pendant combien de temps — y compris les choix de paiement et de mesure que vous contrôlez. Les boutons du sommaire ci-dessous mènent directement à la partie qui vous intéresse.",
  updatedAt: LAST_UPDATED,
  updatedAtIso: LAST_UPDATED_ISO,
  retentionNote:
    "Nos durées de conservation sont énoncées comme des engagements internes et non comme des durées fixées par la loi. L'entreprise doit confirmer la durée de conservation comptable avec son comptable.",
  sections: [
    {
      id: "scope",
      heading: "Qui nous sommes et ce que couvre cette notice",
      body: `Cette notice explique comment ${SITE.legalName} (« KC Technology », « nous ») traite les données personnelles collectées via ce site, notre boutique en ligne, nos formulaires de demande de renseignements et de devis, ainsi que nos annonces immobilières.

Nous sommes le responsable du traitement de ces données. Notre siège social est situé à ${POSTAL_ADDRESS}, et vous pouvez nous joindre pour toute question de confidentialité à ${CONTACT_EMAIL} ou au ${CONTACT_PHONE}.`,
    },
    {
      id: "what-we-collect",
      heading: "Ce que nous collectons",
      body: `**Lorsque vous nous contactez ou demandez un devis.** Votre nom, votre adresse e-mail, un numéro de téléphone facultatif, l'objet et le corps de votre message et, le cas échéant, le fichier que vous joignez, tel qu'une photographie ou un plan. Si vous soumettez une demande de devis, nous enregistrons le nom de fichier d'origine de toute pièce jointe.

**Lorsque vous créez un compte.** Votre nom complet, votre adresse e-mail et votre mot de passe. Le mot de passe est géré par notre prestataire d'authentification et n'est jamais conservé sous une forme lisible.

**Lorsque vous passez une commande.** Votre nom, votre adresse e-mail, un numéro de téléphone facultatif, le mode d'obtention (livraison ou retrait) et, pour une livraison, l'adresse de livraison, la ville, la région et toute note de livraison que vous ajoutez.

**Lorsque vous naviguez et que nous mesurons.** Si vous autorisez la mesure, nous enregistrons les pages consultées et des événements d'interaction simples, comme les produits consultés ou ajoutés au panier. Nous n'envoyons ni noms, ni adresses e-mail, ni numéros de téléphone à notre service de mesure. Si vous refusez la mesure, aucun script de mesure n'est chargé du tout.

**Automatiquement, pour la sécurité et les archives.** Lorsque vous soumettez une demande de renseignements ou de devis, nous enregistrons une empreinte unidirectionnelle salée de votre adresse IP, la chaîne user-agent de votre navigateur et l'heure de la soumission. L'empreinte est calculée avec un sel secret et ne peut pas être inversée pour retrouver votre adresse IP. Nous l'enregistrons pour détecter et limiter les abus, non pour vous identifier.

Nous ne collectons ni numéros de carte, ni numéros de mobile money, ni identifiants bancaires. Le paiement est effectué sur la page hébergée de notre prestataire, et ces données n'atteignent jamais ce site.`,
    },
    {
      id: "why",
      heading: "Pourquoi nous les utilisons et la base légale",
      body: `Nous utilisons les données personnelles pour :

1. répondre à votre demande et préparer un devis ;
2. créer et administrer votre compte, notamment confirmer votre adresse e-mail et permettre une réinitialisation de mot de passe ;
3. traiter, honorer et livrer une commande, et vérifier le paiement auprès de notre prestataire ;
4. organiser une visite d'un bien ou transmettre votre demande à l'agent concerné ;
5. sécuriser le site, prévenir les abus et limiter les soumissions automatisées ;
6. mesurer l'utilisation du site, mais uniquement lorsque vous l'avez autorisé ;
7. respecter nos obligations légales, comptables et fiscales.

Nos bases légales sont : l'**exécution d'un contrat** lorsque le traitement est nécessaire à l'exécution d'une commande ou d'un projet vous concernant ; votre **consentement** pour les cookies de mesure et la mesure publicitaire facultative ; nos **intérêts légitimes** à répondre aux demandes, sécuriser le site et améliorer nos services, mis en balance avec vos droits ; et nos **obligations légales** pour les archives que nous devons conserver.

Les cookies et la mesure sont décrits dans la section Cookies ci-dessous. Lorsque la mesure repose sur votre consentement, vous pouvez le retirer à tout moment sans perdre l'accès au site.`,
    },
    {
      id: "sharing",
      heading: "Avec qui nous les partageons",
      body: `Nous faisons appel à un petit nombre de prestataires et ne partageons les données que dans la mesure nécessaire à leur prestation :

1. **Supabase** — hébergement de la base de données qui contient les comptes, les commandes, les demandes et les annonces.
2. **Fapshi** (et ses canaux partenaires de mobile money et bancaires) — traitement de votre paiement et confirmation de sa réussite. Fapshi reçoit le montant, la devise et une référence de la commande, et vous saisissez vos données de paiement sur sa propre page.
3. **Tolgee** — le service de gestion des traductions qui fournit les textes de l'interface du site.
4. **Notre prestataire d'e-mail** — l'envoi pour notre compte des e-mails de compte et de demande.
5. **Google Analytics** — uniquement si vous autorisez la mesure, et recevant des événements d'usage anonymes sans identifiant direct.
6. **Conseils professionnels, auditeurs et autorités** — lorsque nous devons divulguer des informations, ou lorsque cela est nécessaire pour constater, exercer ou défendre un droit en justice.

Nous ne vendons pas vos données personnelles et ne les partageons pas pour le marketing indépendant de tiers. Certains de ces prestataires traitent des données sur des serveurs situés hors du Cameroun, notamment dans l'Union européenne et aux États-Unis.`,
    },
    {
      id: "retention",
      heading: "Combien de temps nous les conservons",
      body: `Nous ne conservons les données personnelles que le temps nécessaire à la finalité pour laquelle elles ont été collectées :

1. **Comptes** — pendant la durée d'ouverture de votre compte, puis pendant une courte période après sa fermeture, afin de régler toute commande ou demande en cours.
2. **Demandes et devis ne donnant pas lieu à des travaux** — jusqu'à 24 mois après le dernier contact, puis suppression.
3. **Commandes, factures et preuves de paiement** — pendant la durée de conservation comptable et fiscale qui nous est imposée, que nous traitons comme étant de 10 ans.
4. **Fichiers joints aux devis** — avec la demande à laquelle ils se rattachent, et supprimés selon le même calendrier.
5. **Données de sécurité (empreinte IP et user-agent)** — pendant une durée limitée suffisante pour détecter un schéma d'abus, puis suppression.
6. **Données de mesure** — selon la conservation de notre prestataire de mesure, et non reliées par nos soins à un identifiant.

À l'expiration d'une durée de conservation, nous supprimons les données, ou les rendons irréversiblement anonymes lorsqu'elles sont nécessaires sous forme agrégée.`,
    },
    {
      id: "cookies",
      heading: "Cookies et mesure",
      body: `Nous utilisons un petit nombre de cookies et technologies similaires. La mesure est **désactivée par défaut** : si vous n'avez pas répondu à la bannière, aucun script de mesure n'est chargé.

1. **Essentiels** — vous maintenir connecté et mémoriser un choix, comme votre langue ou vos préférences de cookies. Ils ne peuvent être désactivés sans casser le site.
2. **Mesure** — comptage anonyme des visites de pages et des événements d'interaction. Chargés uniquement si vous l'autorisez. Aucun nom, aucune adresse e-mail et aucun numéro de téléphone n'est envoyé. Le retrait du consentement les arrête et supprime le cookie.
3. **Mesure publicitaire** — distincte des précédents et désactivée sauf activation de votre part. Nous l'activons uniquement pour mesurer la performance de notre propre publicité.

Vous pouvez modifier ou retirer vos choix à tout moment via le contrôle des paramètres de cookies situé dans le pied de page du site, et vous pouvez également supprimer ou bloquer les cookies depuis votre navigateur.`,
    },
    {
      id: "rights",
      heading: "Vos droits",
      body: `Vous avez le droit de :

1. **Savoir** si nous détenons des données personnelles vous concernant et d'en recevoir une copie ;
2. **Corriger** les données inexactes ou incomplètes ;
3. **Supprimer** les données lorsque nous n'avons plus de raison de les conserver ;
4. **Limiter ou vous opposer** au traitement, notamment vous opposer à la mesure ou à tout traitement fondé sur nos intérêts légitimes ;
5. **Retirer votre consentement** à tout moment, lorsque le traitement repose sur le consentement, sans affecter le traitement déjà effectué ;
6. **Portabilité** — recevoir les données que vous nous avez fournies dans un format structuré et couramment utilisé ;
7. **Déposer une réclamation** auprès de l'autorité compétente de protection des données au Cameroun.

Pour exercer l'un de ces droits, écrivez à ${CONTACT_EMAIL}. Nous répondrons dans un délai de 30 jours. Une demande portant sur un compte doit émaner d'un titulaire autorisé de ce compte ; nous pouvons donc vous demander de prouver votre identité au préalable.`,
    },
    {
      id: "security",
      heading: "Comment nous les protégeons",
      body: `Les comptes sont authentifiés et les mots de passe sont hachés par notre prestataire d'authentification. L'accès aux données conservées est restreint par rôle, et des règles de sécurité au niveau des lignes de la base déterminent les lignes que chaque rôle peut lire ou écrire. Les espaces d'administration exigent un compte connecté disposant du rôle approprié, et les actions administratives sont consignées dans un journal d'audit.

Les données sont transmises via HTTPS. Nous limitons le nombre de personnes ayant accès aux données clients à celles qui en ont besoin pour leur travail. Aucun système n'est parfaitement sûr, mais si une violation survient et est susceptible de vous exposer à un risque, nous vous en informerons ainsi que l'autorité compétente, comme la loi l'exige.`,
    },
    {
      id: "children",
      heading: "Enfants",
      body: `Ce site et sa boutique s'adressent à des adultes agissant pour eux-mêmes ou pour une entreprise. Nous ne collectons pas sciemment de données personnelles auprès de personnes de moins de 18 ans. Si vous pensez qu'un enfant nous a fourni des données personnelles, contactez-nous à ${CONTACT_EMAIL} et nous les supprimerons.`,
    },
    {
      id: "changes",
      heading: "Modification de cette notice",
      body: `Nous pouvons mettre à jour cette notice à mesure que le site ou le droit évolue. La date en tête de page indique sa dernière modification, et la version publiée ici est celle qui s'applique à votre utilisation du site.`,
    },
  ],
};

export const LEGAL_FR: Record<"terms" | "privacy", LegalDocument> = {
  terms: CONDITIONS,
  privacy: CONFIDENTIALITE,
};
