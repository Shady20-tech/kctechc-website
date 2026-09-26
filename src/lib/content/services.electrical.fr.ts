import type { LocalizedOverlay } from "./types";

/**
 * French overlays for the Electrical Services department.
 *
 * Kept separate from the canonical English in `services.electrical.ts`, mirroring
 * the split the database enforces: canonical text lives with the entity,
 * translations live apart from it. The renderer merges the two through
 * `resolveLocalized`, so this file has the same shape a `content_translations`
 * row would produce.
 *
 * Written as French originals rather than literal translations. The same content
 * rule applies here as to the English: no certifications, standards compliance
 * claims, client names or guarantees. Where the English describes work as carried
 * out to the applicable standard, the French says the same thing without naming a
 * certification the business has not claimed.
 *
 * Every field is present, so no electrical service falls back to English.
 */

export const ELECTRICAL_SERVICE_TRANSLATIONS_FR: Record<string, LocalizedOverlay> =
  {
    "electrical-installation": {
      title: "Installation électrique",
      summary:
        "Câblage, tableaux de distribution, éclairage et circuits de puissance pour constructions neuves, aménagements et mises à niveau, installés et documentés.",
      description:
        "L'installation électrique couvre le câblage fixe et les équipements qui acheminent l'énergie dans un bâtiment : tableaux de distribution, circuits terminaux, prises, points d'éclairage, mise à la terre et les dispositifs de protection qui rendent un défaut sûr plutôt que dangereux.\n\nNous intervenons sur les constructions neuves, les aménagements et les mises à niveau d'installations existantes. La première étape est toujours un relevé de ce qui existe et de ce qu'il devra supporter — la charge que le bâtiment impose réellement, et non celle qu'un occupant précédent avait supposée. Lorsqu'une installation existante est étendue, l'évaluation vérifie si l'alimentation, le tableau et les dispositifs de protection peuvent accepter la demande supplémentaire avant que quoi que ce soit y soit ajouté.\n\nLes installations sont réalisées selon la norme de câblage applicable et remises avec la documentation de ce qui a été installé : schémas de circuits, calibres des dispositifs de protection et résultats des essais effectués avant mise sous tension. Cette trace compte par la suite, lorsque quelqu'un doit savoir quel circuit alimente quoi.\n\nLe travail est planifié selon l'usage du bâtiment. Un commerce, un bureau, un atelier et une habitation imposent des demandes différentes, et une disposition de circuits adaptée à l'un ne conviendra pas à l'autre. Nous convenons de la disposition avec vous avant le début de l'installation, afin que l'agencement corresponde à l'usage réel de l'espace.",
      features: [
        "Évaluation de la charge avant tout ajout de circuit à une installation existante",
        "Tableaux de distribution, circuits terminaux, prises et points d'éclairage",
        "Mise à la terre et dispositifs de protection adaptés au bâtiment",
        "Cheminement des câbles et chemins de câbles pensés selon l'usage de l'espace",
        "Travaux en construction neuve, aménagement et mise à niveau",
        "Documentation de remise : schémas de circuits, calibres et résultats d'essais",
      ],
      faqs: [
        {
          question:
            "Pouvez-vous ajouter des circuits à une installation existante ?",
          answer:
            "Généralement oui, mais pas avant d'avoir évalué l'alimentation et le tableau existants. Ajouter de la charge à une installation déjà proche de sa capacité, c'est ainsi que commence la surcharge. Nous vérifions ce que l'alimentation et le tableau peuvent supporter, et vous disons si la réponse est qu'un élément en amont doit d'abord être modifié.",
        },
        {
          question: "Quelle documentation recevons-nous à la remise ?",
          answer:
            "Un relevé de ce qui a été installé et testé : le schéma des circuits, le calibre de chaque dispositif de protection et les résultats des essais effectués avant la mise sous tension. C'est ce qui permet de rattacher un défaut ultérieur au bon circuit sans tâtonnement.",
        },
        {
          question: "Intervenez-vous sur des bâtiments occupés ?",
          answer:
            "Oui. Les travaux en bâtiment occupé sont planifiés par étapes afin que certaines parties de l'installation restent sous tension et utilisables, et que tout ce qui doit être isolé le soit pour une durée connue plutôt que de façon indéterminée.",
        },
      ],
      deliveryNotes:
        "Réalisé comme un projet relevé et étagé : évaluation d'abord, puis un périmètre et un calendrier convenus, puis l'installation et les essais. En bâtiment occupé, le programme est organisé autour de vos horaires d'exploitation afin que la coupure d'un circuit ait lieu au moment qui convient au bâtiment.",
    },

    "solar-energy-systems": {
      title: "Systèmes d'énergie solaire",
      summary:
        "Production solaire, stockage sur batterie et alimentation hybride dimensionnés selon la charge réelle du site, y compris l'instabilité du réseau.",
      description:
        "Un système solaire ne vaut que par l'évaluation de charge qui le sous-tend. Dimensionner selon la surface ou selon un chiffre nominal produit un système qui s'effondre sous la demande réelle, ou qui a été payé sans jamais servir. Nous dimensionnons selon la charge réellement appelée par le site, mesurée lorsque c'est possible, et selon son comportement au fil de la journée.\n\nLes choix de conception découlent de cette évaluation : quelle production mérite d'être installée, quelle capacité de batterie est justifiée, et si le système doit fonctionner en parallèle du réseau, en secours pendant les coupures, ou de façon autonome. Au Cameroun, la stabilité du réseau varie selon les zones : la conception doit donc tenir compte de la fréquence et de la durée des interruptions, et pas seulement de la consommation moyenne.\n\nLe stockage sur batterie est l'élément le plus souvent mal dimensionné. La capacité est ajustée à ce que vous devez maintenir en service pendant une coupure — quels circuits comptent, et pour combien de temps — plutôt qu'à un chiffre rond. Lorsqu'un site dispose d'un groupe électrogène, le système est conçu pour fonctionner avec lui plutôt que pour le doubler.\n\nChaque système est mis en service et testé sur site avant la remise, et les paramètres qui régissent son comportement sont documentés afin qu'une modification ultérieure n'ait pas à être reconstituée.",
      features: [
        "Évaluation de charge mesurée sur la consommation réelle, non un chiffre nominal",
        "Dimensionnement de la production pour les configurations raccordées, de secours et autonomes",
        "Capacité de batterie ajustée aux circuits qui doivent rester alimentés",
        "Conception hybride fonctionnant avec un groupe existant plutôt que le doublant",
        "Fixation, câblage, protection et mise à la terre adaptés aux conditions du site",
        "Mise en service, essais sur site et paramètres système documentés",
      ],
      faqs: [
        {
          question: "Comment déterminez-vous la taille d'un système ?",
          answer:
            "À partir de la charge appelée par le site et de son comportement au fil de la journée, mesurée lorsque c'est possible. Dimensionner selon la surface ou une consommation nominale produit des systèmes qui échouent sous la demande réelle. Nous demandons aussi combien de temps une coupure doit être couverte, car c'est ce qui fixe la capacité de batterie plutôt que la production.",
        },
        {
          question:
            "Un système solaire peut-il fonctionner avec un groupe électrogène ?",
          answer:
            "Oui, et lorsqu'un site dispose déjà d'un groupe, c'est généralement l'arrangement le plus pertinent. Le groupe couvre la demande forte ou prolongée, et le solaire avec batterie couvre la charge courante et les coupures courtes, ce qui réduit la fréquence de fonctionnement du groupe.",
        },
        {
          question: "Le système demande-t-il beaucoup d'entretien ?",
          answer:
            "Les panneaux nécessitent un nettoyage et une inspection occasionnelle, et les paramètres de la batterie et de l'onduleur méritent d'être revus lorsque la charge du site évolue. Le programme d'entretien est convenu à la remise et les paramètres sont documentés, afin qu'il ne dépende pas de la disponibilité de l'installateur pour être interprété.",
        },
      ],
      deliveryNotes:
        "Réalisé en relevé, conception, installation et mise en service. Les paramètres du système et les résultats des essais de mise en service sont remis sous forme de relevé, afin que l'installation puisse être entretenue et étendue sans avoir à reconstituer sa configuration.",
    },

    "maintenance-repairs": {
      title: "Maintenance et réparations",
      summary:
        "Recherche de défaut, maintenance planifiée et réparations qui rétablissent l'installation et identifient la cause de la panne.",
      description:
        "Un défaut électrique est un symptôme. Un disjoncteur qui déclenche de façon répétée, un circuit qui chauffe ou un appareil qui lâche vous dit quelque chose sur l'installation, et remplacer la pièce sans comprendre la cause, c'est ainsi que le même défaut revient.\n\nNous diagnostiquons d'abord : ce qui a échoué, ce qu'a fait le courant de défaut, et si la cause est un composant défectueux, un circuit surchargé, une connexion desserrée ou une infiltration d'eau. La réparation découle de ce diagnostic, et lorsque le défaut est le symptôme d'un problème de fond — un circuit qui n'a jamais été dimensionné pour sa charge, par exemple — nous le disons plutôt que de réparer le même point le mois suivant.\n\nLa maintenance planifiée est l'autre volet de ce travail. L'inspection périodique des tableaux, des dispositifs de protection et des connexions détecte la dégradation qui mène aux pannes : échauffement à une borne desserrée, dispositif qui ne déclenche plus à son courant nominal, isolation vieillissante. Une visite qui détecte ces signes tôt coûte moins cher que la panne qu'ils auraient provoquée.\n\nLes travaux curatifs comme les travaux planifiés sont documentés, si bien qu'un site constitue un historique de ce qui a échoué et de ce qui a été fait. Cet historique est ce qui transforme la maintenance d'une dépense récurrente en une décision.",
      features: [
        "Diagnostic avant réparation, pour identifier la cause et non seulement le symptôme",
        "Réparation des circuits, tableaux, dispositifs de protection et équipements",
        "Visites de maintenance planifiée avec inspection des tableaux, dispositifs et connexions",
        "Contrôles thermiques et de continuité sur les connexions et dispositifs de protection",
        "Identification des circuits jamais dimensionnés pour leur charge actuelle",
        "Historique documenté des défauts constatés et des travaux réalisés",
      ],
      faqs: [
        {
          question:
            "Notre disjoncteur déclenche sans arrêt. Qu'est-ce que cela signifie ?",
          answer:
            "Cela signifie que le dispositif de protection fait son travail : soit le circuit appelle plus qu'il ne devrait, soit il présente un défaut. Les deux doivent être établis avant toute modification. Remplacer le dispositif ou le réarmer sans cesse ne traite aucune des deux causes et supprime la protection qui évitait une issue plus grave.",
        },
        {
          question: "À quelle fréquence une installation doit-elle être entretenue ?",
          answer:
            "Cela dépend de l'installation et de son intensité d'usage. Un atelier faisant tourner des machines lourdes demande une attention plus fréquente qu'un bureau. Nous convenons d'un programme à partir de ce que contient le site et de son usage, puis l'ajustons une fois que l'historique des inspections est connu.",
        },
        {
          question: "Réparez-vous les équipements autant que le câblage ?",
          answer:
            "Nous réparons et remplaçons les équipements électriques fixes et les circuits qui les desservent. Lorsqu'un équipement n'est plus réparable de façon économique, nous le disons et chiffrons son remplacement plutôt que de le rapiécer à répétition.",
        },
      ],
      deliveryNotes:
        "Disponible en intervention curative ou en programme de maintenance convenu. Le travail curatif commence par un diagnostic ; le travail planifié suit un programme convenu à partir de ce que contient le site. Dans les deux cas la visite est documentée, si bien que le site accumule un historique de maintenance plutôt qu'une série de réparations isolées.",
    },

    "smart-home-automation": {
      title: "Domotique résidentielle",
      summary:
        "Éclairage, climatisation, accès et surveillance pilotés de façon à continuer de fonctionner sans réseau ni internet.",
      description:
        "La domotique, c'est de l'électricité avec une couche de pilotage par-dessus, et c'est cette couche qui déçoit le plus souvent. Un système entièrement dépendant d'un service cloud et d'une connexion internet cesse de fonctionner quand l'un ou l'autre manque — y compris l'éclairage, précisément au moment où vous en avez besoin.\n\nLa conception part de ce qui doit être pilotable et de ce qui doit continuer de fonctionner quoi qu'il arrive. L'éclairage essentiel et les accès sont organisés pour rester utilisables localement lorsque le réseau est absent, tandis que la programmation, l'accès à distance et les scènes utilisent le réseau lorsqu'il est disponible. Cette séparation est un choix de conception, non un ajout, et c'est pourquoi l'architecture de pilotage est arrêtée avant le choix des appareils.\n\nNous intervenons sur les domaines habituels : éclairage et scènes, climatisation et production d'eau chaude, accès portail et portes, et surveillance telle que caméras et capteurs. Les appareils sont choisis pour fonctionner ensemble plutôt que comme un ensemble d'applications séparées, et lorsqu'un site dispose déjà d'équipements qui méritent d'être conservés, la conception les intègre au lieu d'exiger un remplacement complet.\n\nL'automatisation est mise en service et démontrée sur site, et la configuration est documentée, afin qu'une modification ultérieure ne nécessite pas l'interprétation de l'installateur d'origine.",
      features: [
        "Architecture de pilotage conçue pour que l'éclairage et les accès fonctionnent sans internet",
        "Scènes d'éclairage, programmation et commande multipoint",
        "Pilotage de la climatisation et de la production d'eau chaude",
        "Intégration du contrôle d'accès portail et portes",
        "Surveillance par caméras et capteurs intégrée au système de pilotage",
        "Mise en service sur site, démonstration et configuration documentée",
      ],
      faqs: [
        {
          question: "Que deviennent les lumières lorsque internet tombe ?",
          answer:
            "Elles continuent de fonctionner. L'éclairage essentiel et le contrôle d'accès sont organisés pour fonctionner localement plutôt que par un service cloud : une connexion perdue coûte l'accès à distance et la programmation, pas la possibilité d'allumer une lumière. C'est une décision prise au départ, d'où l'accord sur l'architecture de pilotage avant le choix des appareils.",
        },
        {
          question: "Pouvez-vous travailler avec des équipements existants ?",
          answer:
            "Lorsqu'ils méritent d'être conservés, oui. La conception intègre les équipements existants plutôt que d'exiger le remplacement de toute l'installation, et nous indiquons clairement quels appareils existants s'intégreront ou non.",
        },
        {
          question: "Pourrons-nous modifier les réglages nous-mêmes ?",
          answer:
            "Oui. La configuration est documentée et le système est démontré à la remise, si bien que les modifications courantes comme les scènes et les programmes peuvent être faites sans l'installateur d'origine. Les modifications structurelles de l'architecture de pilotage constituent un travail distinct.",
        },
      ],
      deliveryNotes:
        "Réalisé comme une installation conçue plutôt qu'une pose d'appareils : architecture de pilotage d'abord, puis choix des appareils, puis mise en service. La configuration est documentée et démontrée sur site, afin que le système puisse être ajusté par la suite sans dépendre de l'installateur d'origine.",
    },

    "cctv-security": {
      title: "Vidéosurveillance et sécurité",
      summary:
        "Systèmes de caméras, de contrôle d'accès et d'alarme pensés selon ce qu'il faut voir, enregistrer et traiter.",
      description:
        "Un système de sécurité n'est utile que s'il répond aux questions que vous lui poserez réellement : qui est entré, que s'est-il passé à ce portail, et il y a combien de temps. Cela commence par la planification de la couverture plutôt que par un nombre de caméras — décider quels accès, quelles limites et quelles zones intérieures comptent, et ce qui doit être identifiable à chacun d'eux.\n\nLa conception en découle : positions et types de caméras choisis selon la lumière et la distance propres à chaque emplacement, capacité d'enregistrement dimensionnée selon la profondeur d'historique nécessaire, et stockage organisé pour que les images survivent à la perte d'un appareil. Une caméra mal placée pour la distance ou la lumière produit des images qui enregistrent un événement sans l'identifier : c'est la façon la plus courante dont un système échoue.\n\nLe contrôle d'accès et les alarmes sont pensés avec les caméras plutôt que séparément, afin qu'une entrée, une porte laissée ouverte et son enregistrement forment un seul système au lieu de trois qu'il faut ensuite réconcilier. Lorsqu'un site subit des coupures d'alimentation, l'alimentation propre du système est conçue pour y survivre, car un système de sécurité qui s'arrête avec le secteur est absent exactement quand on a besoin de lui.\n\nL'installation comprend la mise en service et une visite de la couverture, afin que ce que le système voit soit démontré plutôt que supposé.",
      features: [
        "Planification de la couverture selon les accès et zones qui comptent",
        "Choix des caméras selon la lumière et la distance à chaque position",
        "Capacité d'enregistrement dimensionnée selon la durée de conservation souhaitée",
        "Stockage organisé pour que les images survivent à la perte d'un appareil",
        "Intégration du contrôle d'accès et des alarmes avec le système de caméras",
        "Alimentation de secours pour que le système survive à une coupure du secteur",
      ],
      faqs: [
        {
          question: "De combien de caméras avons-nous besoin ?",
          answer:
            "C'est la mauvaise première question, d'où notre choix de planifier la couverture avant le nombre de caméras. Ce qui compte, ce sont les accès et zones à voir, et ce qui doit être identifiable à chacun. Une fois cela arrêté, le nombre en découle — et il est souvent plus faible qu'avec un plan partant du nombre, car les positions sont choisies dans un but plutôt que pour couvrir le plan uniformément.",
        },
        {
          question: "Combien de temps les images sont-elles conservées ?",
          answer:
            "Aussi longtemps que nécessaire, ce qui fixe la capacité d'enregistrement. Nous convenons d'abord de la durée de conservation, car un stockage dimensionné sans objectif soit s'épuise plus tôt que prévu, soit est payé sans être utilisé.",
        },
        {
          question: "Que se passe-t-il pendant une coupure de courant ?",
          answer:
            "Le système est conçu pour continuer de fonctionner sur sa propre alimentation pendant une interruption, car c'est là qu'il importe le plus. La durée de secours fait partie de la conception et est indiquée à la remise plutôt que laissée à découvrir.",
        },
      ],
      deliveryNotes:
        "Réalisé en planification de couverture, installation, mise en service et visite de couverture. La durée de conservation et la durée de secours sont convenues lors de la conception et démontrées à la remise, afin que ce que le système enregistre et pendant combien de temps soit connu plutôt que supposé.",
    },

    "equipment-supply-sales": {
      title: "Fourniture et vente d'équipements",
      summary:
        "Fourniture d'équipements, de composants et de matériels électriques adaptés à l'installation qu'ils desserviront.",
      description:
        "La fourniture d'équipements ressemble à une transaction et se traite mieux comme une partie de la conception. Un dispositif de protection, un câble ou un tableau se choisissent en fonction du circuit desservi — son courant, son environnement et le niveau de défaut à ce point. Fournir un composant sans ce contexte, c'est ainsi que les installations se retrouvent avec des dispositifs qui ne se coordonnent pas, ou avec un câble prévu pour une distance plus courte que celle installée.\n\nNous fournissons les équipements pour les installations que nous réalisons et pour celles que d'autres réalisent, en les adaptant à la spécification plutôt qu'à ce qui se trouve en stock. Lorsqu'une spécification exige un calibre ou un type particulier, nous le disons et le fournissons, plutôt que de substituer un équivalent proche en laissant la différence se découvrir à la mise en service.\n\nLa disponibilité compte, en particulier pour les équipements à commander. Lorsqu'un délai affecte votre programme, nous vous le disons avant l'engagement, et non après, afin que le calendrier puisse être planifié en conséquence. Lorsqu'un substitut est réellement équivalent, nous le proposons comme un choix avec la différence expliquée, et non comme un remplacement silencieux.\n\nL'authenticité des équipements est le point central. Les dispositifs de protection et les câbles contrefaits ou re-marqués sont un vrai problème sur le marché, et ils défaillent d'une manière qui n'est pas visible avant qu'un défaut ne survienne. Nous fournissons des équipements de fabricants établis par des canaux traçables.",
      features: [
        "Équipements adaptés au circuit desservi, non à ce qui est en stock",
        "Tableaux, dispositifs de protection, câbles, chemins de câbles et accessoires",
        "Spécification respectée quant au calibre et au type exigés",
        "Délais annoncés avant l'engagement, non après",
        "Substituts proposés comme un choix expliqué plutôt qu'un remplacement silencieux",
        "Équipements issus de fabricants établis par des canaux traçables",
      ],
      faqs: [
        {
          question:
            "Pouvez-vous fournir des équipements pour une installation que nous réalisons nous-mêmes ?",
          answer:
            "Oui. Nous fournissons sur spécification aussi aisément que pour nos propres installations. Envoyez le bordereau ou les exigences et nous chiffrerons en conséquence, en vous indiquant ce qui est indisponible ou ce pour quoi il existe un équivalent authentique.",
        },
        {
          question:
            "Pourquoi le calibre exact d'un dispositif de protection importe-t-il ?",
          answer:
            "Parce que les dispositifs de protection sont choisis pour se coordonner avec le circuit et entre eux. Un dispositif de calibre ou de type inadapté peut ne pas protéger le câble qu'il dessert, ou déclencher avant celui situé en amont, ce qui transforme un défaut sur un circuit en perte d'alimentation pour plusieurs.",
        },
        {
          question: "Fournissez-vous le câble à la longueur ?",
          answer:
            "Oui. Le câble est fourni pour la distance nécessaire, et lorsque la spécification exige une section particulière, nous fournissons cette section plutôt que la plus proche disponible.",
        },
      ],
      deliveryNotes:
        "Fourni sur spécification ou bordereau, pour nos propres installations comme pour celles réalisées par d'autres. Les délais affectant un programme sont annoncés avant l'engagement, et toute substitution est proposée comme un choix expliqué.",
    },

    "safety-inspections": {
      title: "Inspections de sécurité",
      summary:
        "Inspection et essais d'une installation existante, avec un rapport écrit de ce qui a été constaté et de ce qui doit être traité.",
      description:
        "Une inspection établit l'état réel d'une installation. Cela vaut la peine avant un achat, avant un changement d'usage, lorsqu'un assureur le demande, et périodiquement pour toute installation en service depuis des années sans contrôle.\n\nLe travail est un examen structuré et non un simple coup d'œil. Il couvre les dispositions d'arrivée et d'alimentation, les tableaux et leurs dispositifs de protection, l'état du câblage et de ses connexions, la mise à la terre et les liaisons équipotentielles, ainsi que les essais qui établissent si les dispositifs de protection fonctionnent comme prévu. Lorsque quelque chose ne peut être examiné sans perturber l'installation, le rapport le dit plutôt que de laisser supposer une exhaustivité que l'inspection n'a pas eue.\n\nLe résultat est un rapport écrit : ce qui a été inspecté, ce qui a été constaté, quelles observations sont urgentes et lesquelles peuvent être planifiées, et ce que la norme applicable exige dans chaque cas. Il distingue un défaut, un écart par rapport à la norme et une recommandation, car ces éléments n'ont pas le même poids et ne sont pas la même chose.\n\nNous rendons compte de l'installation que nous inspectons. Nous ne délivrons pas de certificats que nous ne sommes pas habilités à délivrer, et lorsqu'un certificat formel d'un autre organisme est requis, nous le disons plutôt que de substituer notre rapport à celui-ci.",
      features: [
        "Inspection structurée de l'arrivée, des tableaux, des circuits, de la terre et des liaisons",
        "Essais des dispositifs de protection pour établir qu'ils fonctionnent comme prévu",
        "Rapport écrit distinguant défauts, écarts par rapport à la norme et recommandations",
        "Observations classées comme urgentes ou comme travaux planifiables",
        "Périmètre énoncé honnêtement lorsque quelque chose n'a pu être examiné",
        "Adapté à l'achat, au changement d'usage, à l'assurance et à la revue périodique",
      ],
      faqs: [
        {
          question: "Que recevons-nous après une inspection ?",
          answer:
            "Un rapport écrit couvrant ce qui a été inspecté, ce qui a été constaté et ce qui en découle. Les observations sont séparées en défauts, écarts par rapport à la norme applicable et recommandations, et classées comme urgentes ou planifiables. Le périmètre est énoncé honnêtement, y compris ce qui n'a pu être examiné sans perturber l'installation.",
        },
        {
          question: "Délivrez-vous des certificats ?",
          answer:
            "Nous rendons compte de l'installation que nous inspectons. Lorsqu'un certificat formel émanant d'un organisme précis est requis pour vos besoins, nous vous le disons clairement plutôt que de substituer notre rapport d'inspection à celui-ci. Nous ne délivrons pas de certificats que nous ne sommes pas habilités à délivrer.",
        },
        {
          question: "Quand une inspection vaut-elle la peine ?",
          answer:
            "Avant d'acheter un bien, avant de changer l'usage d'un bâtiment, lorsqu'un assureur ou un bailleur en demande une, et périodiquement pour toute installation en service depuis des années sans contrôle. Une inspection est aussi la première étape sensée avant d'étendre une installation, car elle établit ce que les travaux existants peuvent supporter.",
        },
      ],
      deliveryNotes:
        "Réalisé en une visite d'inspection suivie d'un rapport écrit. Le rapport est le livrable, et il est rédigé pour qu'une autre personne que l'inspecteur puisse agir dessus : les observations sont classées par type et par urgence plutôt que présentées en une seule liste.",
    },

    "industrial-project-contracting": {
      title: "Contrats de projets industriels",
      summary:
        "Lot électrique de projets industriels, de la conception et la spécification à l'installation, aux essais et à la remise.",
      description:
        "Le travail électrique industriel est une discipline de projet. Il comprend les dispositions d'alimentation et de distribution des machines et équipements de process, le contrôle et la protection des moteurs et variateurs, les chemins de câbles et le câblage qui acheminent puissance et contrôle dans une usine, ainsi que la documentation qui permet d'exploiter et de maintenir l'installation ensuite.\n\nNous prenons le lot électrique dans son ensemble plutôt que comme une série de travaux séparés : conception et spécification, fourniture des équipements, installation, essais et remise. C'est ainsi que les parties restent cohérentes entre elles — une étude de coordination des dispositifs de protection n'a par exemple aucun sens si les dispositifs sont ensuite fournis et installés selon une autre disposition que celle étudiée.\n\nLes projets sont programmés par étapes, le travail électrique étant séquencé par rapport au chantier global. Lorsque le travail électrique dépend de l'arrivée d'un équipement ou de l'achèvement du génie civil, cette dépendance figure au programme plutôt que d'être découverte quand les électriciens arrivent sur site et que le sol n'est pas prêt.\n\nLa remise, c'est de la documentation : plans de récolement reflétant ce qui a réellement été installé plutôt que ce qui a été conçu, schémas de circuits et de tableaux, réglages des dispositifs et résultats d'essais. Sur une installation industrielle, cette trace n'est pas une formalité — c'est ce qui rend l'usine maintenable par quelqu'un d'autre que l'entreprise d'origine.",
      features: [
        "Lot électrique complet : conception, spécification, fourniture, installation, essais",
        "Dispositions d'alimentation et de distribution des machines et équipements de process",
        "Contrôle, protection et coordination des moteurs et variateurs",
        "Chemins de câbles et câblage des circuits de puissance et de contrôle",
        "Programmation étagée par rapport au chantier global, dépendances énoncées",
        "Plans de récolement, schémas, réglages des dispositifs et résultats d'essais à la remise",
      ],
      faqs: [
        {
          question:
            "Prenez-vous le lot électrique complet ou des travaux isolés ?",
          answer:
            "Nous privilégions le lot complet, car les parties d'une installation industrielle se contraignent mutuellement. Une étude de coordination des dispositifs de protection ne vaut rien si les dispositifs sont ensuite fournis et installés selon une autre disposition. Prendre le lot dans son ensemble, c'est ce qui garde conception, fourniture et installation cohérentes.",
        },
        {
          question: "Que recevons-nous à la remise ?",
          answer:
            "Des plans de récolement reflétant ce qui a été installé plutôt que ce qui a été conçu, les schémas de circuits et de tableaux, les réglages des dispositifs de protection et de contrôle, et les résultats des essais effectués. Sur une usine, cette trace est ce qui rend l'installation maintenable par quelqu'un d'autre que l'entreprise qui l'a construite.",
        },
        {
          question: "Pouvez-vous travailler aux côtés d'autres entreprises ?",
          answer:
            "Oui, et sur une usine c'est généralement inévitable. Le programme électrique est séquencé par rapport au chantier global, et lorsque le travail électrique dépend de l'arrivée d'un équipement ou de l'achèvement du génie civil, cette dépendance est énoncée au programme plutôt que découverte sur site.",
        },
      ],
      deliveryNotes:
        "Réalisé comme un lot électrique contractuel au sein d'un projet plus large, programmé par étapes avec les dépendances envers d'autres corps d'état annoncées d'emblée. La remise comprend la documentation de récolement, les réglages des dispositifs et les résultats d'essais.",
    },

    "low-medium-voltage-line-design-construction": {
      title: "Conception et construction de lignes BT/MT",
      summary:
        "Conception et construction de lignes de distribution basse et moyenne tension, incluant relevé, poteaux, conducteurs et protection.",
      description:
        "Les lignes aériennes et souterraines acheminent l'énergie entre une source et le point d'utilisation, et leur conception est gouvernée par le tracé autant que par la charge. La portée d'une ligne, ses distances de sécurité, le conducteur utilisé et la protection à chaque extrémité découlent tous de son tracé et de ce qu'elle doit franchir.\n\nLe travail commence par un relevé de tracé : le chemin que prendra la ligne, ce qu'elle surplombe et ce qu'elle croise, où elle peut être supportée, et où l'accès pour la construction puis la maintenance est possible. Ce relevé détermine l'ouvrage — positions et hauteurs des poteaux, longueurs de portée, choix du conducteur et distances de sécurité à respecter — et c'est pourquoi une ligne conçue sans relevé est généralement reconçue pendant la construction.\n\nNous construisons ensuite : poteaux ou tranchées, conducteurs ou câbles, raccordements, et l'appareillage et la protection qui rendent la ligne sûre à exploiter et possible à isoler. La chute de tension sur la longueur du tracé est calculée plutôt que supposée, car une ligne qui délivre une tension acceptable à sa source et inacceptable à son extrémité n'a pas été conçue pour son usage réel.\n\nLa construction est suivie d'essais et de mise sous tension, ainsi que de la documentation de ce qui a été construit : le tracé tel que réalisé, les caractéristiques des conducteurs et des équipements, et les résultats d'essais. Les lignes sont construites selon la norme applicable à leur classe de tension, et les distances de sécurité comme les dispositions de protection sont conçues conformément à celle-ci.",
      features: [
        "Relevé de tracé couvrant les croisements, distances de sécurité et accès de maintenance",
        "Conception de l'ouvrage : positions et hauteurs des poteaux, portées et conducteurs",
        "Calcul de la chute de tension sur toute la longueur du tracé",
        "Construction de lignes aériennes et souterraines basse et moyenne tension",
        "Raccordements, appareillage et dispositions de protection",
        "Essais, mise sous tension et documentation de récolement",
      ],
      faqs: [
        {
          question: "Pourquoi un relevé de tracé vient-il d'abord ?",
          answer:
            "Parce que le tracé détermine la conception. Les longueurs de portée, les distances de sécurité, le choix du conducteur et les points de support découlent tous du chemin emprunté et de ce qui est franchi. Une ligne conçue sans relevé est généralement reconçue pendant la construction, ce qui coûte plus cher que de la relever d'abord.",
        },
        {
          question: "Comment la chute de tension est-elle traitée sur une ligne longue ?",
          answer:
            "Elle est calculée sur toute la longueur du tracé plutôt que supposée à partir de la tension à la source. Une ligne peut délivrer une tension acceptable à sa source et inacceptable à son extrémité : c'est une erreur de conception qui ne devient visible qu'une fois la ligne en service.",
        },
        {
          question: "Quelle documentation est fournie pour une ligne achevée ?",
          answer:
            "Le tracé tel que réellement construit, les caractéristiques des conducteurs et des équipements installés, les dispositions de protection, et les résultats des essais effectués avant mise sous tension. C'est ce à partir de quoi un défaut futur ou une extension devra être traité.",
        },
      ],
      deliveryNotes:
        "Réalisé en relevé, conception, construction et mise sous tension. Le relevé de tracé et le calcul de chute de tension sont effectués avant la construction plutôt que pendant, et la ligne achevée est remise avec la documentation de récolement et les résultats d'essais.",
    },
  };
