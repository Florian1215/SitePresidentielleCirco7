/**
 * Programme pour les Français·es de l'étranger, construit collectivement à partir de
 * L'Avenir en commun et des réalités constatées par les élu·es consulaires insoumis·es.
 * Les mesures sont regroupées dans les 6 grandes parties du programme national.
 */

import { CategoryIcon } from './category-icons';

export interface Mesure {
  title: string;
  text: string;
  /** Mesure phare, mise en avant en tête de catégorie. */
  key?: boolean;
}

/** Couleurs des parties, reprises du livre-programme sur melenchon2027.fr. */
export type CategoryColor = 'vert' | 'jaune' | 'rouge' | 'orange' | 'violet' | 'bleu';

export interface Category {
  slug: string;
  color: CategoryColor;
  icon: CategoryIcon;
  title: string;
  intro: string;
  mesures: Mesure[];
}

export const URGENCES = [
  { slug: 'securite-sociale', title: "L'urgence sociale", text: "Continuité des droits, protection sociale minimale, école accessible : aucun·e compatriote ne doit être laissé·e seul·e face à une crise." },
  { slug: '6e-republique', title: "L'urgence démocratique", text: "Des élu·es consulaires dotés de vrais pouvoirs, une AFE renforcée, et des citoyen·nes qui voient l'effet de leur vote." },
  { slug: 'ecologie', title: "L'urgence environnementale", text: "Une bifurcation écologique planifiée du réseau extérieur et la fin des soutiens publics aux projets fossiles." },
];

export const CATEGORIES: Category[] = [
  {
    slug: 'ecologie',
    color: 'vert',
    icon: 'leaf',
    title: "Pour une bifurcation écologique et sociale",
    intro: "Incendies, inondations, sécheresses : les Français·es de l'étranger sont souvent les premiers témoins du dérèglement climatique. La responsabilité écologique de la France ne s'arrête pas à ses frontières. La bifurcation doit être planifiée, financée et socialement juste.",
    mesures: [
      { key: true, title: 'Mettre fin au soutien public aux projets fossiles', text: "Conditionner les financements, garanties à l'export et soutiens de Business France à des objectifs sociaux et écologiques vérifiables, et exclure les nouveaux projets d'exploration ou d'exploitation des énergies fossiles." },
      { key: true, title: "Étendre le droit international de l'environnement", text: "Défendre la reconnaissance du crime d'écocide, la création d'une juridiction internationale climatique et environnementale, la protection des biens communs mondiaux et la justice pour les pertes et dommages climatiques." },
      { key: true, title: 'Rénover et adapter le parc immobilier du réseau extérieur', text: "Programmer la rénovation énergétique et l'adaptation climatique des bâtiments de l'État, en priorisant les zones les plus exposées, et inscrire des exigences de performance énergétique et de sobriété dans toute acquisition ou location." },
      { title: 'Adopter une programmation écologique du réseau extérieur', text: "Établir pour les ambassades, consulats, instituts culturels et établissements scolaires des objectifs pluriannuels et publics sur l'énergie, l'eau, les achats, les déchets, les déplacements et les émissions. Publier chaque année les résultats." },
      { title: 'Faire des établissements scolaires des lieux de bifurcation', text: "Financer des plans élaborés avec les élèves, les personnels, les parents et les élu·es consulaires sur l'alimentation, les transports, la biodiversité, les déchets, l'eau et l'éducation populaire à l'écologie." },
      { title: 'Créer un volet écologique du STAFE', text: "Soutenir les projets qui associent les Français·es de l'étranger aux populations locales autour de l'adaptation climatique, de la biodiversité, de l'accès à l'eau, de l'agroécologie ou du recyclage, même lorsque leurs bénéficiaires ne sont pas majoritairement français." },
      { title: 'Soutenir les coopérations écologiques locales', text: "Financer des partenariats entre associations, collectivités, écoles, universités et petites structures qui protègent les forêts, les océans, les sols, la biodiversité et les ressources en eau." },
      { title: 'Préparer les communautés aux catastrophes', text: "Intégrer les risques climatiques aux plans de sécurité consulaires, établir des cartes de vulnérabilité, diffuser des alertes accessibles et prévoir des protocoles pour les personnes âgées, handicapées ou isolées." },
      { title: 'Une mobilité écologiquement responsable et socialement juste', text: "Préserver les déplacements familiaux essentiels, réduire les missions inutiles, développer les alternatives ferroviaires et faire contribuer davantage l'aviation d'affaires et les usages les plus fréquents." },
      { title: 'Rendre les achats et la restauration exemplaires', text: "Introduire des critères de proximité, de durabilité, de réduction des emballages, de respect du droit du travail et de lutte contre la déforestation importée dans les marchés du réseau extérieur." },
      { title: "Créer un réseau d'expertise écologique des Français de l'étranger", text: "Associer élu·es consulaires, chercheur·euses, associations, syndicats et professionnel·les afin de documenter les impacts locaux et d'éclairer le Parlement." },
      { title: "Protéger les défenseurs de l'environnement", text: "Mobiliser les moyens diplomatiques et consulaires pour les scientifiques, journalistes, syndicalistes, peuples autochtones et militant·es menacé·es en raison de leur action." },
    ],
  },
  {
    slug: 'economie',
    color: 'jaune',
    icon: 'credit-card',
    title: "Une économie au service des besoins",
    intro: "Salarié·es, stagiaires, indépendant·es, petites structures : vivre à l'étranger ne doit pas signifier travailler sans droits ni rester sans filet face à une crise.",
    mesures: [
      { key: true, title: 'Créer un fonds de soutien aux petites activités en crise', text: "Aider les indépendant·es, associations et très petites entreprises affecté·es par une catastrophe sanitaire, climatique ou sécuritaire lorsqu'ils et elles respectent des critères sociaux et environnementaux." },
      { key: true, title: "Protéger les travailleur·euses français·es à l'étranger", text: "Diffuser une information fiable sur le droit local, les conventions de l'Organisation internationale du travail, la syndicalisation et les recours en cas de non-paiement ou d'exploitation." },
      { key: true, title: 'Garantir le droit au compte et aux paiements', text: "Lutter contre les clôtures discriminatoires liées à la résidence et améliorer l'accès aux services bancaires nécessaires aux impôts, pensions et démarches administratives." },
      { title: 'Protéger les stagiaires et volontaires', text: "Garantir une information sur le droit local, une convention claire, une couverture sociale et des recours en cas d'exploitation." },
      { title: 'Faciliter la reconnaissance des acquis professionnels', text: "Améliorer la validation des diplômes, compétences et expériences lors d'un retour en France, y compris pour l'accès aux concours et emplois publics." },
      { title: "Renforcer l'insertion professionnelle des femmes", text: "Soutenir les associations d'aide à l'emploi, de mise en réseau et de promotion des femmes entrepreneuses à l'étranger." },
    ],
  },
  {
    slug: 'securite-sociale',
    color: 'rouge',
    icon: 'heart',
    title: "Mettre en sécurité sociale",
    intro: "Consulats éloignés, délai de carence au retour, aides inégales selon les pays, violences et discriminations : trop de compatriotes se retrouvent seul·es face aux difficultés. Il y a urgence à mettre la nouvelle France en sécurité sociale, où qu'elle vive.",
    mesures: [
      { key: true, title: 'Supprimer le délai de carence de trois mois au retour', text: "Ouvrir immédiatement les droits à l'Assurance maladie aux Français·es qui se réinstallent durablement en France lorsqu'ils ne relèvent ni d'une activité professionnelle ni d'un accord de coordination applicable." },
      { key: true, title: "Garantir une voie d'accès humaine", text: "Maintenir un accueil physique ou téléphonique pour toutes les démarches essentielles, avec un dispositif prioritaire pour les urgences, le handicap et les personnes vulnérables. Le développement de France Consulaire doit être encouragé, mais il ne peut justifier un recul des services « physiques »." },
      { key: true, title: 'Renforcer la catégorie aidée de la CFE', text: "Financer par le budget de l'État les missions de service public assurées par la CFE : catégorie aidée et accès sans questionnaire médical ni condition d'âge. Instaurer la progressivité des cotisations de la catégorie aidée afin qu'elle demeure accessible aux plus vulnérables. Étendre jusqu'à 26 ans le soutien destiné aux jeunes vulnérables." },
      { key: true, title: 'Un protocole mondial contre les violences sexistes et sexuelles', text: "Désigner des référent·es formé·es dans chaque poste, garantir un contact d'urgence et constituer un réseau fiable d'avocat·es, médecins, psychologues et associations." },
      { title: 'Augmenter les crédits des programmes 151 et 105', text: "Rétablir les moyens nécessaires à l'administration des Français·es, à l'action sociale, aux élections, aux bourses scolaires et au soutien associatif." },
      { title: "Renforcer l'organisation de tournées consulaires régulières", text: "Assurer la collecte des demandes de titres, l'état civil, l'information sociale et l'inscription électorale dans les zones éloignées du poste consulaire." },
      { title: 'Renforcer les agences consulaires', text: "Attribuer aux consuls honoraires des moyens, des formations et des outils adaptés, sans leur transférer des missions qui doivent rester exercées par des agents publics." },
      { title: 'Étendre et améliorer France Consulaire', text: "Garantir des horaires couvrant les principaux fuseaux, un suivi des demandes et la possibilité d'être orienté vers le poste compétent sans recommencer la démarche." },
      { title: 'Renforcer les aides sociales consulaires', text: "Étendre jusqu'à 26 ans le soutien financier consulaire aux jeunes vulnérables, en prolongeant le secours mensuel spécifique enfant au-delà de la majorité. Garantir une couverture santé par la CFE aux allocataires sociaux, notamment aux bénéficiaires de l'allocation de solidarité âgé·es de plus de 65 ans." },
      { title: "Consolider les organismes locaux d'entraide", text: "Conclure des conventions pluriannuelles avec les associations qui accompagnent les personnes âgées, les malades, les familles précaires et les victimes de violences. Simplifier les critères du STAFE et encourager les projets favorisant l'insertion sociale, la lutte contre les discriminations et la protection de l'environnement." },
      { title: 'Simplifier les retraites internationales', text: "Améliorer la totalisation des périodes travaillées, sécuriser les certificats de vie par plusieurs voies et réviser les décotes qui pénalisent les carrières courtes ou fragmentées. Afficher dans le compte retraite, dès le retour en France, les périodes d'assurance accomplies à l'étranger lorsque les accords le permettent." },
      { title: 'Conclure de nouvelles conventions de sécurité sociale', text: "Faire aboutir en priorité les discussions avec l'Australie et permettre l'entrée en vigueur de l'accord avec la Chine. Ouvrir des négociations avec les principaux pays dépourvus de convention et renégocier les accords qui créent des ruptures de droits." },
      { title: 'Créer un guichet unique du retour en France', text: "Permettre, depuis l'étranger, de constituer un dossier unique transmis aux organismes compétents (Assurance maladie, CAF, France Travail, préfecture et rectorat) et d'en suivre l'avancement en un seul endroit, avec une procédure accélérée pour les retours liés à une crise, une séparation, une maladie ou une situation de vulnérabilité." },
      { title: 'Un fonds de solidarité pour les victimes', text: "Financer l'hébergement, les soins, l'aide psychologique, les frais juridiques, la traduction et, si nécessaire, le transport vers un lieu sûr." },
      { title: 'Former chaque année les personnels', text: "Organiser une formation obligatoire sur les violences, le racisme, les LGBTphobies, le handicap, le harcèlement et l'accueil des victimes." },
      { title: "Garantir l'information sur les droits sexuels et reproductifs", text: "Rendre accessibles les informations sur la contraception, l'IVG, les soins et les dispositifs de soutien, notamment dans les pays où ces droits sont restreints." },
      { title: 'Des postes diplomatiques sûrs et accessibles', text: "Créer une procédure indépendante de signalement des violences sexistes et des discriminations, et mettre en conformité les locaux, sites, documents et réunions avec les exigences d'accessibilité." },
      { title: 'Protéger les droits des personnes LGBTQIA+', text: "Garantir un accueil confidentiel, une information fiable et une protection renforcée lorsque l'orientation sexuelle ou l'identité de genre sont criminalisées." },
      { title: "Accompagner les séparations et déplacements internationaux d'enfants", text: "Renforcer l'information juridique, la coopération judiciaire et garantir la sécurité des mères qui protègent leurs enfants victimes d'inceste, dans le respect de l'intérêt supérieur de l'enfant." },
      { title: "Améliorer la transcription de l'état civil", text: "Réduire les délais, sécuriser les parcours des familles binationales et garantir l'égalité de traitement des familles reconnues par le droit français." },
      { title: 'Soutenir les associations de défense des droits', text: "Financer de façon transparente les structures locales d'accompagnement des victimes et de prévention des violences et discriminations." },
    ],
  },
  {
    slug: 'futur',
    color: 'orange',
    icon: 'globe',
    title: "Le goût du futur : aux nouvelles frontières de l'humanité",
    intro: "L'éducation n'est pas un marché. Chaque enfant doit pouvoir apprendre en français, où qu'il vive. Et la culture francophone appartient à toutes celles et ceux qui la font vivre, sur tous les continents.",
    mesures: [
      { key: true, title: 'Instaurer un bouclier tarifaire', text: "Plafonner le reste à charge selon un barème progressif fondé sur les revenus et la composition du foyer, après déduction des bourses, afin qu'aucune famille ne consacre une part excessive de ses revenus aux frais de scolarité." },
      { key: true, title: 'Refondre les bourses scolaires', text: "Mieux adapter les enveloppes à l'inflation, aux taux de change et au coût de la vie dans chaque pays, réduire les effets de seuil, mieux prendre en compte les classes moyennes et réexaminer rapidement les dossiers après une perte de revenu, une séparation ou une crise. Instaurer comme critère principal d'attribution le reste à charge des familles. Réviser les critères applicables aux familles monoparentales lorsque l'un des parents n'acquitte pas de manière récurrente la pension fixée par une décision de justice." },
      { key: true, title: 'Garantir des solutions à tous les enfants hors du réseau', text: "Garantir l'accès au CNED réglementé à tout élève français attestant d'un éloignement géographique d'un établissement homologué. Renforcer les bourses pour garantir la gratuité pour les familles modestes et instaurer une tarification progressive selon les ressources. Assurer aux associations FLAM un financement pluriannuel tenant compte des effectifs accueillis, des besoins sociaux et des coûts locaux." },
      { key: true, title: "Garantir l'accès à la culture des Français·es de l'étranger", text: "Rendre Culturethèque gratuitement accessible à tous nos compatriotes, renforcer les médiathèques et les programmations culturelles de proximité et soutenir les projets des associations, des établissements scolaires et des réseaux FLAM." },
      { title: 'Rééquilibrer le développement du réseau', text: "Réorienter Cap 2030 afin de garantir une véritable politique publique d'enseignement français, pilotée selon les besoins des familles, la qualité pédagogique et les moyens publics disponibles, et non une croissance fondée sur la marchandisation." },
      { title: 'Donner la priorité aux EGD et réinvestir dans le service public', text: "Donner la priorité à l'extension et à la création d'établissements en gestion directe. Renforcer ainsi l'ossature publique du réseau, garantir les ressources nécessaires au financement des personnels détachés et assurer la péréquation entre établissements." },
      { title: 'Réaffirmer la primauté du service public', text: "Placer l'AEFE sous la tutelle conjointe du ministère de l'Éducation nationale et du ministère de l'Europe et des Affaires étrangères afin de réintégrer dans le budget de l'Éducation nationale les cotisations de pensions civiles des professeur·es détaché·es, et de faire peser les impératifs éducatifs, sociaux et pédagogiques autant que les objectifs diplomatiques." },
      { title: 'Garantir un financement pluriannuel', text: "Inscrire les crédits de l'AEFE dans une trajectoire de trois ans liée à son contrat d'objectifs et de moyens, et interdire les transferts de charges imprévus vers les établissements et les familles." },
      { title: 'Reprendre en charge les pensions civiles', text: "Engager, dès le prochain budget, la compensation par l'État des pensions civiles des personnels de l'Éducation nationale détachés à l'AEFE et suspendre les mesures de transfert de ces charges aux familles." },
      { title: 'Rendre les comptes transparents', text: "Mettre en place une comptabilité analytique, publier les coûts par mission, clarifier les trésoreries immobilisées et rendre compte de la valeur des services facturés aux établissements." },
      { title: 'Mesurer le non-recours et les départs du réseau', text: "Informer les conseils consulaires du nombre d'enfants français non scolarisés dans le réseau, du nombre de désinscriptions et de leurs motifs, notamment financiers, afin d'ajuster la carte scolaire, les bourses et les dispositifs alternatifs." },
      { title: "Investir d'abord dans les établissements existants", text: "Rétablir la capacité d'emprunt de l'AEFE pour moderniser les établissements en gestion directe, rénover les bâtiments, les adapter au changement climatique et garantir leur accessibilité." },
      { title: 'Stabiliser les équipes pédagogiques', text: "Préserver les personnels détachés dans les zones où ils sont indispensables, permettre des détachements jusqu'à neuf ans et mieux accompagner leur retour afin d'éviter une rotation permanente des équipes." },
      { title: 'Protéger les personnels de droit local et développer la formation', text: "Garantir leur représentation dans les instances, faire respecter leurs droits sociaux et syndicaux, et conditionner l'homologation à un plan de formation continue adapté à chaque zone." },
      { title: 'Démocratiser la gouvernance du réseau', text: "Créer une instance permanente de concertation associant parents, personnels, élèves, anciens élèves, élu·es consulaires et associations FLAM. Publier en amont les perspectives budgétaires, les évolutions d'effectifs et les créations ou suppressions de postes." },
      { title: "Financer pleinement l'école inclusive", text: "Désigner une maison départementale des personnes handicapées référente pour les Français de l'étranger, accélérer l'ouverture des droits, prendre en charge les accompagnants et sécuriser leur intervention par des conventions associant la famille, l'établissement et l'accompagnant." },
      { title: "Refuser la marchandisation et conditionner l'homologation", text: "Instaurer une régulation stricte de l'homologation pour privilégier la qualité pédagogique, l'accessibilité sociale et la souveraineté du modèle éducatif français. Exiger des établissements partenaires des obligations vérifiables en matière de niveau pédagogique, de formation, de frais, de gouvernance, d'inclusion, de mixité sociale, de droit du travail et de transparence financière." },
      { title: "Développer l'accompagnement à l'orientation", text: "Organiser des permanences en ligne adaptées aux fuseaux horaires et associer les établissements, les élu·es consulaires et les services universitaires." },
      { title: 'Accompagner les enseignant·es de français', text: "Proposer des formations, des ressources, des échanges de pratiques et un appui à la structuration de réseaux professionnels." },
      { title: 'Valoriser toutes les francophonies', text: "Associer davantage les acteurs culturels, artistes et binationaux aux Alliances françaises, Instituts français et services de coopération, et développer des ressources culturelles et éducatives numériques libres." },
      { title: 'Un parcours étudiant dédié aux jeunes Français·es de l\'étranger', text: "Créer sur messervices.etudiant.gouv.fr un parcours reliant Parcoursup et Mon Master, le dossier social étudiant, le logement, la reconnaissance des diplômes et l'ouverture des droits à l'Assurance maladie, avec dépôt unique des pièces et assistance accessible depuis l'étranger." },
      { title: "Garantir l'accès immédiat aux droits étudiant·es", text: "Permettre aux jeunes qui s'installent en France pour étudier d'ouvrir sans délai leurs droits sociaux et d'accéder aux services universitaires." },
      { title: 'Reconnaître les diplômes et parcours étrangers', text: "Accélérer les attestations de comparabilité, réduire les frais de traduction et éviter la répétition de certifications déjà établies." },
      { title: 'Reconstruire le service public culturel à l\'étranger', text: "Rétablir une programmation budgétaire pluriannuelle pour les Instituts français, les Alliances françaises, les établissements de recherche et les services culturels, tout en garantissant les droits de leurs personnels recrutés localement." },
      { title: 'Démocratiser la coopération culturelle', text: "Associer les artistes, les associations, les personnels, les élu·es consulaires et les sociétés civiles locales à la définition des programmations. Préserver l'autonomie des Alliances françaises et mettre fin aux politiques culturelles décidées exclusivement depuis Paris." },
      { title: 'Créer un fonds de coopération et de création francophone', text: "Financer des coproductions associant plusieurs pays dans le cinéma, la musique, le spectacle vivant, le livre, le jeu vidéo et les médias numériques, sélectionnées par des jurys internationaux." },
      { title: 'Soutenir le plurilinguisme et la traduction', text: "Financer la traduction des œuvres du français vers les langues locales, créoles et régionales, et réciproquement. Développer le sous-titrage, l'édition bilingue et la circulation des littératures du monde francophone." },
      { title: 'Garantir la visibilité des créations francophones en ligne', text: "Imposer davantage de transparence aux plateformes et construire avec les pays francophones des obligations communes de mise en valeur des œuvres en français. Renforcer TV5MONDEplus et ouvrir sa gouvernance aux médias publics des différents continents." },
      { title: 'Créer un programme de mobilité culturelle francophone', text: "Financer, sous conditions sociales, la circulation réciproque des artistes, traducteur·ices, étudiant·es, chercheur·euses et professionnel·les de la culture, notamment dans une logique Sud-Sud." },
      { title: 'Décoloniser les relations culturelles', text: "Adopter une loi-cadre facilitant la restitution des biens acquis illicitement pendant la période coloniale, accélérer les recherches de provenance et garantir l'accès aux archives." },
      { title: 'Acter la propriété commune de la langue française', text: "Soutenir la création d'une académie francophone installée hors de France et réunissant des écrivain·es, artistes, enseignant·es, chercheur·euses et représentant·es des sociétés civiles de tous les continents." },
      { title: 'Soutenir la culture et la recherche françaises à l\'étranger', text: "Renforcer les crédits culturels de proximité, financer la coopération scientifique associant les chercheur·euses établi·es à l'étranger aux laboratoires publics." },
    ],
  },
  {
    slug: '6e-republique',
    color: 'violet',
    icon: 'landmark',
    title: "Fonder la 6e République",
    intro: "Les élu·es des Français·es de l'étranger n'ont presque aucun pouvoir réel. La démocratie se renforce quand les élu·es ont des moyens, quand une délibération reçoit une réponse et quand les citoyen·nes voient l'effet de leur vote.",
    mesures: [
      { key: true, title: 'Réviser la loi du 22 juillet 2013', text: "Attribuer aux conseils consulaires un droit de saisine, des compétences délibératives sur une part des crédits locaux et un budget pour les réunions publiques, les déplacements et l'expertise." },
      { key: true, title: "Renforcer l'Assemblée des Français·es de l'étranger", text: "Lui attribuer un budget propre, un secrétariat permanent, un appui juridique et légistique, un pouvoir d'audition et un droit d'initiative. Transmettre aux deux assemblées toute résolution adoptée à l'unanimité par l'AFE afin d'en demander l'inscription à l'ordre du jour." },
      { key: true, title: "Associer les Français·es de l'étranger à la VIe République", text: "Garantir leur représentation dans le processus constituant et examiner la place du Sénat, de l'AFE et des conseils consulaires dans les nouvelles institutions." },
      { title: 'Rendre la consultation et la réponse obligatoires', text: "Imposer au Gouvernement de consulter les conseils consulaires et l'AFE sur les réformes qui les concernent, puis de répondre dans un délai fixé à leurs délibérations." },
      { title: "Ouvrir le débat sur l'élection directe de l'AFE", text: "Étudier un scrutin permettant aux citoyen·nes de désigner directement leurs représentant·es à l'Assemblée des Français·es de l'étranger." },
      { title: 'Augmenter le nombre de bureaux de vote', text: "Ouvrir des sites supplémentaires lorsque les distances, les frontières intérieures ou les capacités de transport rendent le vote à l'urne difficile." },
      { title: 'Garantir plusieurs modalités de vote sûres', text: "Maintenir le vote à l'urne, par procuration et par internet, prévoir une solution de secours et soumettre le vote électronique à des audits publics indépendants." },
      { title: "Faciliter l'inscription électorale", text: "Organiser des campagnes régulières, des rappels avant les dates limites et une vérification simple des coordonnées de contact." },
      { title: "Une cellule d'évaluation des politiques publiques auprès de l'AFE", text: "Examiner, avant chaque réforme fiscale ou sociale, ses effets sur les non-résident·es, les familles binationales et les personnes qui reviennent en France." },
      { title: 'Associer les jeunes aux décisions consulaires', text: "Réserver des consultations et des groupes de travail aux moins de 30 ans sur l'éducation, l'emploi, le climat et la participation démocratique." },
    ],
  },
  {
    slug: 'monde',
    color: 'bleu',
    icon: 'shield',
    title: "Un monde ordonné",
    intro: "Les Français·es de l'étranger sont souvent les premiers témoins des guerres et des atteintes aux droits. La France doit retrouver son indépendance pour se mettre au service de la paix. Les crimes de guerre doivent être jugés, et le droit international respecté.",
    mesures: [
      { key: true, title: 'Agir pour mettre fin au génocide à Gaza', text: "Exiger le respect intégral et durable du cessez-le-feu, la levée du blocus, l'accès humanitaire complet, le retour des personnes déplacées et la protection des personnels médicaux et humanitaires, des journalistes et des agents des Nations unies. Cesser toute vente d'armes à Israël." },
      { key: true, title: 'Soutenir pleinement la justice internationale', text: "Coopérer avec la CPI, protéger son indépendance et ses moyens, refuser toute mesure de rétorsion contre ses magistrats et exécuter les mandats d'arrêt en vigueur. Soutenir la procédure engagée devant la CIJ et l'exécution de ses mesures conservatoires." },
      { key: true, title: 'Rendre au Parlement le contrôle des engagements militaires et des ventes d\'armes', text: "Soumettre tout envoi de forces armées à l'étranger à une autorisation préalable du Parlement, renouvelée chaque année. Rendre effective et pluraliste la commission chargée des exportations d'armements et soumettre les accords de défense à autorisation parlementaire." },
      { title: "Rétablir les moyens de l'action diplomatique", text: "Renforcer les capacités d'analyse, de coopération, de traduction et de présence de terrain, ainsi que les droits des personnels, dans le cadre d'une loi de programmation pluriannuelle de notre outil diplomatique." },
      { title: 'Faire du droit international la règle commune', text: "Soutenir l'ONU, la Cour internationale de Justice, la Cour pénale internationale et l'application cohérente de leurs décisions, sans deux poids, deux mesures." },
      { title: 'Décréter un embargo sur les armes et suspendre les accords complices', text: "Interdire les transferts d'armes susceptibles de contribuer aux crimes commis à Gaza, demander la suspension de l'accord d'association UE-Israël et imposer des sanctions ciblées aux responsables de violations graves." },
      { title: "Faire vivre la reconnaissance de l'État de Palestine", text: "Tirer toutes les conséquences de la reconnaissance française du 22 septembre 2025 : défendre la pleine souveraineté palestinienne sur les territoires occupés depuis 1967, Jérusalem-Est comme capitale, et agir pour la fin de l'occupation, de la colonisation et de l'annexion." },
      { title: "Combattre partout la prise d'otages et la détention arbitraire", text: "Faire de la libération des otages, des prisonnier·es de conscience et des personnes détenues arbitrairement une exigence constante, quels que soient les auteurs ou les États concernés, et renforcer la protection consulaire des Français·es emprisonné·es à l'étranger." },
      { title: 'Améliorer la protection en période de crise', text: "Actualiser les plans de sécurité, les capacités d'évacuation, l'information multilingue et les dispositifs destinés aux personnes vulnérables, sans discrimination de nationalité ou de situation familiale." },
      { title: 'Défendre les droits des personnes migrantes', text: "Faire du sauvetage des vies, du droit d'asile, de la lutte contre les traitements inhumains et du respect des conventions internationales des priorités de l'action française et européenne." },
      { title: 'Développer la coopération populaire', text: "Soutenir les échanges scolaires, universitaires, scientifiques, syndicaux, culturels et associatifs, ainsi que les volontariats de solidarité internationale accessibles sous condition de ressources." },
      { title: "Protéger les lanceurs d'alerte et les défenseurs des droits", text: "Mobiliser les visas, l'accueil, l'asile et la protection diplomatique lorsque leur sécurité est menacée." },
      { title: "Associer les Français·es de l'étranger à la diplomatie de paix", text: "Valoriser leurs connaissances linguistiques, professionnelles et culturelles, et organiser la remontée de leurs alertes et analyses vers le Parlement et le ministère." },
      { title: 'Défendre une diplomatie féministe cohérente', text: "Évaluer l'impact des politiques étrangères sur les droits des femmes et soutenir les organisations locales qui les défendent." },
      { title: 'Faire de la paix une priorité budgétaire', text: "Renforcer la prévention des conflits, la coopération civile, la diplomatie scientifique, l'aide humanitaire indépendante et le financement des juridictions internationales." },
    ],
  },
];
