import type { LocalizedOverlay } from "./types";

/**
 * French overlays for the Digital Marketing services.
 *
 * Kept separate from the canonical English in `services.ts` to mirror the split
 * the database enforces: canonical text lives with the entity, translations live
 * apart from it. The renderer merges the two through `resolveLocalized`, so this
 * file is the same shape a `content_translations` row would produce.
 *
 * These are written as French originals rather than literal translations, which
 * is what the brand-voice guidance in this phase asks for. A field left out here
 * falls back to English for that field alone; nothing is left out below.
 */

export const SERVICE_TRANSLATIONS_FR: Record<string, LocalizedOverlay> = {
  "social-media-marketing": {
    title: "Marketing sur les réseaux sociaux",
    summary:
      "Planification, publication et gestion de la présence d'une entreprise sur les réseaux sociaux, avec un calendrier éditorial et des rapports exploitables.",
    description:
      "Le marketing sur les réseaux sociaux couvre le travail continu de représentation d'une entreprise sur les plateformes sociales : décider quoi publier, publier régulièrement, répondre aux messages et mesurer ce que l'activité produit. C'est un engagement récurrent plutôt qu'une tâche ponctuelle, car un compte qui s'interrompt perd la portée qu'il a construite.\n\nNous commençons par convenir de l'audience visée et de l'objectif du compte — demandes de renseignements, ventes, recrutement ou crédibilité. Nous construisons ensuite un calendrier éditorial, produisons les publications et gérons la publication et les réponses au quotidien. Le marché camerounais étant bilingue, les audiences anglophones et francophones peuvent être servies par la même marque avec un contenu pensé pour chacune, plutôt qu'une traduction littérale de l'une vers l'autre.\n\nLe travail est mesuré par rapport aux objectifs fixés au départ. Les rapports indiquent ce qui a été publié, comment cela a performé et ce qui change le mois suivant, afin que le compte soit géré selon un plan.",
    features: [
      "Stratégie de canaux : quelles plateformes valent l'effort, et lesquelles écarter",
      "Un calendrier éditorial convenu à l'avance, pour une publication prévisible",
      "Production des publications : textes, visuels et formats vidéo courts",
      "Gestion de communauté : réponses aux commentaires et messages privés",
      "Promotion payante de certaines publications lorsque la portée organique ne suffit pas",
      "Rapports mensuels par rapport aux objectifs convenus",
    ],
    faqs: [
      {
        question: "Quelles plateformes sociales gérez-vous ?",
        answer:
          "Les plateformes sont choisies selon votre audience et non selon une liste figée. Facebook et Instagram couvrent l'essentiel de la portée grand public au Cameroun, LinkedIn convient aux activités entre entreprises, et TikTok mérite examen lorsque l'audience est plus jeune. Nous recommandons un ensemble au départ et expliquons pourquoi chaque plateforme est incluse ou non.",
      },
      {
        question: "À quelle fréquence une entreprise doit-elle publier ?",
        answer:
          "La régularité compte davantage que le volume. Un rythme tenable sur une année vaut mieux qu'une série de publications quotidiennes suivie d'un silence. Nous convenons d'une fréquence que vous pouvez soutenir avec les contenus disponibles, puis l'ajustons une fois les données connues.",
      },
      {
        question: "Travaillez-vous en anglais et en français ?",
        answer:
          "Oui. Le marché camerounais est bilingue et nous planifions le contenu pour les audiences anglophones et francophones de façon délibérée, plutôt que de traduire mot pour mot les publications d'une audience vers l'autre.",
      },
    ],
    deliveryNotes:
      "Prestation à distance avec des points de suivi planifiés, ce qui maintient le travail en continu sans exiger votre disponibilité pour chaque publication. Lorsqu'une prise de vue est nécessaire, elle est organisée à l'avance et les ressources produites sont réutilisées sur plusieurs canaux.",
  },

  "website-design-development": {
    title: "Conception et développement de sites web",
    summary:
      "Conception et réalisation de sites d'entreprise rapides, adaptés au mobile, référençables et modifiables.",
    description:
      "Un site d'entreprise doit remplir trois conditions : se charger rapidement sur les téléphones que la plupart des visiteurs utilisent, expliquer clairement l'activité, et rester maintenable après la mise en ligne. Une conception qui néglige ce troisième point produit un site que personne ne peut mettre à jour sans faire appel à un développeur.\n\nNous concevons et réalisons les sites sur des bases modernes — pages rendues côté serveur, mises en page adaptatives et métadonnées structurées — afin que le contenu soit accessible aux moteurs de recherche dès la première réponse, plutôt qu'assemblé par un script ensuite. Ce choix influe autant sur le référencement que sur l'apparence.\n\nAvant la mise en ligne, nous convenons de qui mettra à jour le contenu et comment. Lorsque la réponse est « l'entreprise, sans développeur », le site est construit pour que les modifications courantes — textes, images, tarifs, horaires — se fassent par une interface d'édition plutôt que par du code.",
    features: [
      "Conception adaptative pensée d'abord pour le mobile, et non ajustée après coup",
      "Pages rendues côté serveur, donc un contenu immédiatement visible pour les moteurs de recherche",
      "Gestion de contenu pour les textes, images et mises à jour courantes",
      "Formulaires de contact et de demande reliés à une vraie boîte de réception, avec protection anti-spam",
      "Données structurées et métadonnées pour la recherche et le partage social",
      "Travail d'accessibilité : navigation au clavier, contrastes et champs de formulaire étiquetés",
    ],
    faqs: [
      {
        question: "Combien de temps prend la réalisation d'un site web ?",
        answer:
          "Cela dépend du nombre de pages et de la rapidité avec laquelle les contenus et validations reviennent. Le calendrier est convenu avant le début des travaux et découpé en étapes, afin que vous sachiez toujours ce qui est en cours et ce qui dépend de vous.",
      },
      {
        question: "Puis-je mettre le site à jour moi-même après la mise en ligne ?",
        answer:
          "Oui, lorsque telle est l'organisation convenue. Le contenu courant est placé dans une interface d'édition afin que textes et images puissent être modifiés sans développeur. Les modifications structurelles nécessitent toujours un travail de développement, et nous précisons lesquelles avant la mise en ligne.",
      },
      {
        question: "Le site fonctionnera-t-il avec une connexion lente ?",
        answer:
          "Il est conçu pour cela. Les pages restent légères, les images sont servies dans des formats compressés modernes, et la page est rendue sur le serveur afin que le visiteur n'attende pas qu'un script l'assemble. Cela compte lorsque les visiteurs utilisent des données mobiles.",
      },
    ],
    deliveryNotes:
      "Les noms de domaine, l'hébergement et les e-mails sont enregistrés à votre nom afin que vous en gardiez le contrôle. Vous recevez les comptes et les accès à la livraison, sans dépendance envers nous pour les modifications courantes.",
  },

  seo: {
    title: "Référencement naturel (SEO)",
    summary:
      "Référencement : rendre un site trouvable pour les recherches que ses clients effectuent réellement, et le maintenir ainsi.",
    description:
      "Le référencement naturel consiste à faire apparaître un site dans les résultats de recherche pour les termes utilisés par ses clients. Ce n'est pas une modification unique mais un ensemble de modifications liées : des bases techniques, un contenu qui répond à de vraies questions, et une structure que les moteurs de recherche lisent sans devoir deviner.\n\nNous commençons par la base technique, car les améliorations de contenu sont perdues sur un site qui ne peut pas être exploré ou qui se charge lentement sur mobile. Cela couvre la vitesse des pages, la manière dont elles sont liées, la présence d'un sujet clair par page, et l'indication aux moteurs de recherche des pages existantes.\n\nLe travail porte ensuite sur le contenu : ce que les clients recherchent réellement, quelles recherches l'entreprise peut traiter de façon crédible, et où les pages actuelles sont insuffisantes. Le marché camerounais effectuant des recherches en anglais et en français, la répartition linguistique fait partie du plan : une page rédigée pour des anglophones ne se classe pas pour des requêtes en français.",
    features: [
      "Audit technique : explorabilité, vitesse des pages, comportement mobile et structure du site",
      "Recherche de mots-clés fondée sur les recherches réelles de vos clients",
      "Travail sur la page : titres, descriptions, en-têtes et liens internes",
      "Préparation à la recherche locale pour les clients recherchant au Cameroun",
      "Planification bilingue pour les requêtes en anglais et en français",
      "Mesure continue, afin que les progrès soient rapportés plutôt qu'affirmés",
    ],
    faqs: [
      {
        question: "Combien de temps le référencement met-il à produire des résultats ?",
        answer:
          "Les corrections techniques peuvent être prises en compte en quelques semaines, tandis que les changements de contenu et d'autorité prennent généralement des mois avant d'influer sur le classement. Les moteurs de recherche ont besoin de temps pour réexplorer et réévaluer un site. Nous rapportons ce qui a changé à chaque étape plutôt que de promettre une position à une date fixe, car aucun prestataire honnête ne peut garantir un classement.",
      },
      {
        question: "Ai-je besoin du référencement si je fais de la publicité ?",
        answer:
          "Les deux remplissent des fonctions différentes. La publicité achète de la visibilité tant que vous payez et s'arrête lorsque vous cessez ; le référencement construit une visibilité que vous conservez. La publicité est utile pour des demandes immédiates, et le référencement pour réduire le coût des demandes dans le temps. Beaucoup d'entreprises utilisent les deux.",
      },
      {
        question: "Le référencement est-il différent pour une audience camerounaise ?",
        answer:
          "En partie. Le comportement de recherche, la répartition linguistique et la part des recherches mobiles diffèrent d'autres marchés. La répartition bilingue est la principale différence : les requêtes en anglais et en français nécessitent leurs propres pages, plutôt qu'une seule page tentant de couvrir les deux.",
      },
    ],
    deliveryNotes:
      "Le travail est priorisé par impact, afin que les modifications les plus déterminantes soient faites en premier plutôt qu'en un seul lot final. L'accès à vos outils de mesure et à la console de recherche sert à la mesure, et vous restez propriétaire des deux comptes.",
  },

  "google-online-ads": {
    title: "Publicité Google et en ligne",
    summary:
      "Publicité payante et annonces en ligne : des campagnes conçues pour toucher des personnes déjà en recherche, avec des budgets maîtrisés et des résultats rapportés.",
    description:
      "La publicité en ligne achète de la visibilité pendant qu'elle diffuse. C'est la voie la plus rapide vers des demandes de renseignements et l'endroit le plus facile pour gaspiller de l'argent ; le travail tient donc autant à la maîtrise qu'à la portée : quelles recherches méritent une enchère, ce que peut coûter un clic, et comment cesser de dépenser sur du trafic qui ne convertit jamais.\n\nNous mettons en place les campagnes autour de l'intention. Une personne recherchant un service dont elle a besoin maintenant vaut plus qu'une impression auprès d'une large audience ; les campagnes de recherche sont donc construites à partir des termes qui indiquent un besoin réel, avec des mots-clés négatifs pour exclure les recherches qui y ressemblent seulement. Les budgets sont fixés explicitement et les dépenses sont suivies par rapport aux résultats.\n\nLa mesure est convenue avant le lancement. Il s'agit de définir ce qui constitue une demande, de la suivre, et de rapporter le coût par rapport aux résultats plutôt que les seules impressions et clics. Lorsqu'une campagne ne produit pas, cela est rapporté clairement.",
    features: [
      "Campagnes de recherche construites autour des termes indiquant une intention réelle",
      "Travail sur les mots-clés négatifs, pour cesser de payer des recherches non pertinentes",
      "Budgets explicites et suivi des dépenses, pour un coût prévisible",
      "Pages de destination correspondant à la promesse de l'annonce",
      "Suivi des conversions, afin que les demandes soient comptées plutôt que supposées",
      "Rapports sur le coût par demande, et non seulement sur les clics et impressions",
    ],
    faqs: [
      {
        question: "Combien devrais-je dépenser en publicité ?",
        answer:
          "Il n'existe pas de montant universel. Il se détermine à partir de la valeur d'une demande pour vous et du nombre dont vous avez besoin, puis s'ajuste selon les résultats réels une fois la campagne lancée. Nous convenons d'un budget de départ avec vous et d'un point de réexamen, plutôt que de recommander un chiffre sans connaître vos marges.",
      },
      {
        question: "La publicité fonctionne-t-elle pour une entreprise locale au Cameroun ?",
        answer:
          "Oui. La publicité sur les recherches peut être limitée aux zones que vous desservez réellement, afin qu'une entreprise travaillant dans la région du Sud-Ouest ne paie pas pour apparaître dans tout le pays. Cette maîtrise géographique est l'une des principales raisons d'utiliser la publicité sur les recherches plutôt que des formats plus larges.",
      },
      {
        question: "Que deviennent les annonces si je cesse de payer ?",
        answer:
          "Elles s'arrêtent. C'est la différence essentielle entre la publicité et le référencement : la publicité loue la visibilité tant que le budget dure, tandis que le travail de référencement persiste. Nous précisons clairement lequel des deux vous achetez.",
      },
    ],
    deliveryNotes:
      "Les comptes sont créés à votre nom et la propriété vous reste, afin que l'historique des campagnes et les données d'audience vous appartiennent si la relation de travail change. Les rapports présentent les dépenses aux côtés des résultats, rendant visible le coût de chaque demande.",
  },

  "content-branding": {
    title: "Contenu et image de marque",
    summary:
      "Rédaction, identité de marque et messages qui rendent une entreprise cohérente partout où elle apparaît.",
    description:
      "Le contenu et l'image de marque portent sur la manière dont une entreprise se décrit et sur son apparence. Les deux sont traités ensemble car ils échouent ensemble : des visuels distinctifs portant des messages vagues, ou une rédaction claire portant une identité qui pourrait appartenir à n'importe qui, laissent la même impression.\n\nNous travaillons d'abord le fond — ce que l'entreprise propose réellement, qui elle sert, et ce qui en fait le meilleur choix pour ce client. Cela devient le message utilisé sur le site, les réseaux sociaux, les propositions et la signalétique. Vient ensuite l'identité visuelle : typographie, couleur et mise en page appliquées de façon cohérente, afin que l'entreprise soit reconnaissable partout.\n\nLe marché camerounais étant bilingue, la voix de marque est définie séparément pour l'anglais et le français. Un slogan qui fonctionne dans une langue se lit souvent mal traduit dans l'autre ; les deux sont donc rédigés comme des originaux plutôt que l'un converti à partir de l'autre.",
    features: [
      "Positionnement et messages : ce que vous offrez, à qui, et pourquoi vous",
      "Identité de marque : usage du logo, couleur, typographie et règles de mise en page",
      "Rédaction du site et des supports marketing pour une audience définie",
      "Voix de marque bilingue pour les audiences anglophones et francophones",
      "Un guide d'usage pour que fournisseurs et personnel gardent l'identité cohérente",
      "Modèles pour les documents courants, publications et présentations",
    ],
    faqs: [
      {
        question: "Pouvez-vous travailler avec une identité de marque que nous avons déjà ?",
        answer:
          "Oui. Lorsqu'une identité existe et fonctionne, nous l'appliquons et la documentons plutôt que de la remplacer. Lorsqu'un élément est incohérent ou inutilisable en petit format, nous le signalons et proposons la plus petite modification qui le corrige.",
      },
      {
        question: "Avons-nous besoin d'une identité de marque complète, ou seulement de rédaction ?",
        answer:
          "Ces prestations sont séparables, et beaucoup d'entreprises n'ont besoin que de l'une. Si votre identité est solide et vos messages peu clairs, la rédaction seule est le bon achat. Nous vous dirons lequel s'applique plutôt que de vendre le travail le plus large.",
      },
      {
        question: "Les versions française et anglaise seront-elles cohérentes ?",
        answer:
          "Elles seront cohérentes en voix sans être des traductions littérales. Chaque langue est rédigée pour sa propre audience, en partageant le même positionnement et les mêmes faits.",
      },
    ],
    deliveryNotes:
      "Les livrables comprennent les fichiers sources modifiables et les règles d'usage, afin que l'identité puisse être appliquée par d'autres fournisseurs sans revenir vers nous. La propriété des éléments de marque finaux vous est transférée.",
  },

  "ecommerce-store-development": {
    title: "Développement de boutique en ligne",
    summary:
      "Boutiques en ligne : catalogue, panier, paiement et commandes, conçus pour que le stock et les commandes restent exacts.",
    description:
      "Une boutique en ligne est un site web avec des obligations qu'un site vitrine n'a pas. Elle doit tenir un stock exact, encaisser des paiements de façon fiable et résister aux cas délicats : un paiement qui échoue après la commande, un client qui souhaite un retour, ou une commande à corriger avant expédition.\n\nLa réalisation couvre le catalogue, le panier et le paiement, ainsi que la connexion à un prestataire de paiement. Les détails qui décident de l'utilisabilité sont moins visibles : comment une variante de produit est choisie, ce qui se passe lorsqu'un paiement est refusé, si les frais de livraison sont clairs avant la dernière étape, et comment le commerçant voit et traite une commande.\n\nLe traitement des paiements passe par un prestataire établi plutôt que par le stockage de données de carte. Les prix sont affichés en XAF avec des conditions de livraison claires, car un coût final peu clair est l'une des causes les plus fréquentes d'abandon d'achat en ligne.",
    features: [
      "Catalogue de produits avec variantes, niveaux de stock et catégories",
      "Panier et paiement conçus pour réduire les achats abandonnés",
      "Paiement via un prestataire établi, sans stockage de données de carte",
      "Gestion des commandes pour les voir, les traiter et les corriger",
      "Frais et conditions de livraison clairement affichés avant la dernière étape",
      "Vitrine localisée pour les clients anglophones et francophones",
    ],
    faqs: [
      {
        question: "Quels moyens de paiement une boutique en ligne peut-elle accepter ?",
        answer:
          "Cela dépend du prestataire et de ce que vos clients utilisent. Les paiements par carte sont standards, et l'argent mobile est largement utilisé au Cameroun ; un prestataire prenant en charge les deux est donc généralement le choix pratique. Les moyens précis sont confirmés sur un compte prestataire réel plutôt que supposés.",
      },
      {
        question: "Comment gérer la livraison ?",
        answer:
          "Les options et frais de livraison sont configurés selon votre mode réel de livraison — forfait, par zone, ou retrait sur place. Ils sont présentés au client avant le paiement, afin que le coût final ne soit jamais une surprise.",
      },
      {
        question: "Puis-je gérer moi-même le stock et les commandes ?",
        answer:
          "Oui. La boutique est construite pour que le propriétaire puisse ajouter des produits, ajuster le stock et traiter les commandes sans développeur. Une formation à l'interface fait partie de la livraison.",
      },
    ],
    deliveryNotes:
      "La boutique est construite de sorte que les identifiants de paiement restent dans votre compte prestataire et ne sont jamais traités par nous. Le lancement est progressif : une transaction de test est effectuée de bout en bout avant l'ouverture aux clients.",
  },

  "training-consulting": {
    title: "Formation et conseil",
    summary:
      "Formation pratique et conseil pour que votre équipe gère elle-même ses activités numériques en confiance.",
    description:
      "La formation et le conseil s'adressent aux entreprises qui entendent gérer elles-mêmes leurs activités numériques plutôt que de tout externaliser. L'objectif est la compétence : votre équipe capable de publier, de mesurer et d'améliorer sans devoir demander une autorisation ni attendre une agence.\n\nLa formation est pratique et construite autour de vos outils et comptes réels, et non de diapositives génériques. Les sessions portent sur les vrais comptes sociaux, le vrai site et les vrais rapports, afin que ce qui est appris s'applique le jour même. Lorsqu'une équipe est répartie par rôles, la formation suit cette répartition : ce qu'un responsable doit lire dans un rapport n'est pas ce que la personne qui publie doit faire.\n\nLe conseil est le volet d'accompagnement : examiner ce que vous faites déjà, distinguer ce qui vaut la peine d'être conservé de ce qui coûte de l'effort sans rien rapporter, et convenir d'un plan. Lorsque la réponse honnête est qu'une activité envisagée ne vaut pas l'investissement, nous le disons.",
    features: [
      "Formation pratique sur vos propres comptes et outils, et non sur des exemples génériques",
      "Sessions adaptées aux rôles : responsables et personnes exécutantes",
      "Flux de contenu et de publication que votre équipe peut maintenir",
      "Formation à l'analyse : lire les rapports et décider quoi changer",
      "Audits des activités numériques existantes, avec ce qu'il faut garder et arrêter",
      "Un plan écrit avec priorités et responsabilités",
    ],
    faqs: [
      {
        question: "Formez-vous sur les outils que nous utilisons déjà ?",
        answer:
          "Oui. La formation est construite autour des comptes et outils que vous utilisez réellement, afin que la session soit directement applicable. Lorsqu'un outil actuel n'est pas adapté, cela est soulevé séparément comme recommandation plutôt qu'enseigné comme s'il était satisfaisant.",
      },
      {
        question: "Combien de personnes peuvent participer à une session ?",
        answer:
          "Les sessions fonctionnent mieux en petits groupes afin que chacun puisse suivre sur son propre écran. Lorsqu'une équipe est plus nombreuse, plusieurs sessions sont organisées par rôle plutôt qu'une seule grande présentation.",
      },
      {
        question: "La formation est-elle dispensée en anglais ou en français ?",
        answer:
          "Dans l'une ou l'autre langue, ou les deux lorsqu'une équipe est mixte. Les supports sont fournis dans la langue de la session.",
      },
    ],
    deliveryNotes:
      "Les sessions sont dispensées dans vos locaux ou à distance, et comprennent des supports de référence que l'équipe conserve. Un suivi est disponible après la formation afin que les questions nées de l'usage réel soient traitées plutôt que laissées en suspens.",
  },

  "influencer-affiliate-marketing": {
    title: "Marketing d'influence et d'affiliation",
    summary:
      "Collaborer avec des créateurs et partenaires pour toucher des audiences que vous n'avez pas encore, avec mention publicitaire et mesure correctement gérées.",
    description:
      "Le marketing d'influence et d'affiliation atteint les clients par des personnes qu'ils suivent ou en qui ils ont déjà confiance. Le travail tient largement à la sélection et à la gestion : trouver des partenaires dont l'audience recoupe réellement la vôtre, convenir de ce qu'ils feront, et mesurer si cela a produit un résultat.\n\nLe nombre d'abonnés est un mauvais indicateur à lui seul. Un partenaire à l'audience plus restreinte mais bien ciblée surpasse généralement un partenaire plus large et mal aligné ; la sélection porte donc sur l'identité de l'audience et son engagement, plutôt que sur le chiffre affiché. L'arrangement — ce qui est livré, quand, et à quel coût — est convenu par écrit avant toute publication.\n\nLa mention publicitaire est gérée correctement. Une promotion payante doit être identifiable comme telle, ce qui protège l'audience comme l'entreprise, et les conditions sont convenues avec le partenaire plutôt que laissées à sa discrétion. Les dispositifs d'affiliation sont suivis afin que les commissions soient versées sur des ventes référées réelles et non estimées.",
    features: [
      "Sélection des partenaires selon l'adéquation de l'audience, et non le seul nombre d'abonnés",
      "Accords écrits couvrant les livrables, le calendrier et le coût",
      "Mention claire de la promotion payante, comme l'exigent les règles des plateformes",
      "Suivi d'affiliation pour que la commission soit versée sur des parrainages vérifiés",
      "Briefs de campagne donnant au partenaire un cadre précis",
      "Rapports sur les demandes et les ventes, et non seulement sur la portée",
    ],
    faqs: [
      {
        question: "Comment choisissez-vous un influenceur avec qui travailler ?",
        answer:
          "D'abord selon l'adéquation de l'audience. Nous examinons qui le suit, où, et comment il interagit, puis comparons cela à vos clients réels. Une audience plus restreinte qui correspond à votre marché vaut généralement plus qu'une audience large qui n'y correspond pas.",
      },
      {
        question: "Quelle différence entre marketing d'influence et d'affiliation ?",
        answer:
          "Les influenceurs sont généralement rémunérés pour un contenu défini, tandis que les affiliés perçoivent une commission sur les ventes qu'ils apportent. Le premier achète portée et crédibilité, le second ne paie que les résultats. Le choix dépend de votre besoin de notoriété ou de ventes directes.",
      },
      {
        question: "La promotion payante doit-elle être mentionnée ?",
        answer:
          "Oui. Les règles des plateformes et les normes publicitaires exigent qu'un partenariat payant soit identifiable comme publicité. Nous convenons de la mention avec le partenaire à l'avance afin qu'elle soit claire pour l'audience.",
      },
    ],
    deliveryNotes:
      "Les partenaires reçoivent un brief écrit, et le contenu est examiné par rapport au brief convenu avant publication. Lorsque l'audience d'un partenaire est francophone, le brief et la mention sont préparés en français.",
  },

  "online-business-setup-automation": {
    title: "Mise en place numérique et automatisation",
    summary:
      "Mettre une entreprise en ligne correctement et automatiser le travail répétitif : comptes, outils et processus qui les relient.",
    description:
      "Mettre une entreprise en ligne est surtout une suite de petites décisions coûteuses à changer par la suite : quel domaine et quel hébergement, quelles adresses e-mail, quels comptes, et qui détient les identifiants. Prise à la légère, cette mise en place laisse une entreprise dépendante de celui qui l'a configurée. Prise délibérément, elle permet à l'entreprise de posséder son infrastructure dès le départ.\n\nLa seconde partie est l'automatisation — supprimer le travail manuel répétitif. Cela couvre le quotidien : un formulaire de demande qui s'enregistre et notifie la bonne personne, une facture générée plutôt que saisie, une réservation qui se confirme, un rapport qui arrive sans que personne ne le compile. Chaque élément est modeste ; ensemble, ils rendent des heures chaque semaine.\n\nL'automatisation est appliquée là où elle est réellement fiable. Un processus qui échoue en silence est pire qu'un processus manuel ; tout ce qui est automatisé est donc surveillé et dispose d'un repli défini en cas de défaillance.",
    features: [
      "Domaine, hébergement et e-mail professionnel enregistrés à votre nom, les comptes vous restant",
      "Comptes professionnels configurés avec contrôle d'accès et authentification à deux facteurs",
      "Traitement des demandes : formulaires qui enregistrent, étiquettent et notifient automatiquement",
      "Devis, factures et confirmations de réservation automatisés",
      "Rapports planifiés livrés sans compilation manuelle",
      "Documentation de ce qui a été mis en place et de son fonctionnement",
    ],
    faqs: [
      {
        question: "À qui appartiennent les comptes que vous créez ?",
        answer:
          "À vous. Les domaines, l'hébergement, l'e-mail et les comptes professionnels sont enregistrés à votre nom et les identifiants vous sont remis. Cela compte, car une entreprise qui ne contrôle pas son domaine et son e-mail dépend de celui qui les détient.",
      },
      {
        question: "Que peut-on réellement automatiser ?",
        answer:
          "Les tâches répétitives et fondées sur des règles : acheminer des demandes, générer des documents standards, envoyer des confirmations et compiler des rapports. Le travail nécessitant du jugement n'est pas automatisé. Chaque processus candidat est évalué selon la fiabilité qu'aurait son automatisation avant d'être construit.",
      },
      {
        question: "Que se passe-t-il si un processus automatisé échoue ?",
        answer:
          "Il est surveillé, et chacun dispose d'un repli défini afin que le travail ne soit pas perdu en silence. Une automatisation défaillante que personne ne remarque est pire que le travail manuel ; cela est donc conçu dès le départ.",
      },
    ],
    deliveryNotes:
      "La livraison comprend la documentation écrite des comptes, des automatisations et de la manière de les modifier, afin que l'entreprise ne dépende pas de nous pour les ajustements courants.",
  },
};
