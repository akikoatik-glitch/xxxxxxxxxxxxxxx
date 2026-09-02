// Localization dictionary for xwhiz.com — English (default), French, Arabic.
// Arabic pages render RTL (dir="rtl") with the Tajawal font.
// Keys are referenced by scripts/sitegen.js via t(locale, key, params).
'use strict';

const L = {
  en: {
    meta: { lang: 'en', dir: 'ltr', label: 'English', font: 'Inter' },
    site: {
      name: 'XWhiz',
      tagline: 'Independent statistical football predictions',
      suffix: '| XWhiz',
      home: { title: 'Football Predictions Today — Free Tips, Odds & Live Scores | XWhiz', desc: 'Free football predictions today from our Dixon-Coles statistical model. 1X2, Over/Under 2.5 and BTTS picks with confidence scores, odds and live scores. Updated daily 06:00 UTC.' }
    },
    nav: { predictions: 'Predictions', football: 'Football', live: 'Live Scores', news: 'News', predictor: 'Match Predictor', search: 'Search' },
    topbar: { text: 'Independent statistical football predictions · 18+ gamble responsibly', bonus: 'Melbet bonus' },
    hero: {
      badge: 'Updated daily at 06:00 UTC',
      h1: 'Football predictions today, backed by statistics',
      sub: 'Our Dixon-Coles + Elo model estimates expected goals for every match, then turns them into probabilities for 1X2, Over/Under 2.5 and Both Teams To Score. No streaks, no gut feeling — just maths.',
      cta1: "Today's picks — free",
      cta2: 'Live scores',
      trust: 'Free · Independent · Added daily · Never fake fixtures'
    },
    sec: {
      topPicks: 'Top picks for today',
      latestPicks: 'Latest picks',
      asOf: 'Data as of {date} — refreshed daily at 06:00 UTC',
      todayMatches: 'Today\'s matches',
      allCta: 'All predictions today',
      overCta: 'Over 2.5 tips',
      bttsCta: 'BTTS tips',
      liveTitle: 'Live scores today',
      liveEmpty: 'No matches currently in play.',
      standings: 'Premier League table',
      scorers: 'Top scorers',
      news: 'Latest news',
      newsCta: 'All news',
      leagues: 'Competitions covered',
      howTitle: 'How our predictions work',
      how1: 'Team strength from Elo ratings',
      how2: 'Expected goals from a Dixon-Coles Poisson model',
      how3: 'Probabilities for every market, refreshed daily',
      howBody: 'Each match is evaluated as an independent event. The model outputs a probability for the 1X2 result, totals and Both Teams To Score, plus a recommended pick and its fair price. This is statistical analysis for information purposes — not a promise of profit. 18+, bet responsibly.',
      update: 'Updated daily at 06:00 UTC from football-data.org.',
      dataNote: 'Real fixtures only — we never display invented matches.'
    },
    market: {
      _1x2: '1X2', dc: 'Double Chance', ou: 'Over / Under 2.5', btts: 'Both Teams To Score', cs: 'Correct Score',
      home: 'Home', draw: 'Draw', away: 'Away', over: 'Over 2.5', under: 'Under 2.5', yes: 'Yes', no: 'No',
      conf: 'Confidence', value: 'Value', model: 'Statistical model', markets: 'All markets & predicted odds',
      prob: 'Model probability', pick: 'Pick / odds', updated: 'Last updated'
    },
    status: { scheduled: 'Scheduled', finished: 'Finished', live: 'Live now', ht: 'Half-time', ft: 'Full-time', postponed: 'Postponed', cancelled: 'Cancelled', timed: 'Scheduled' },
    analysis: {
      title: 'Prediction analysis',
      intro: 'We model the {home} vs {away} match (Competition: {league}) with a Dixon-Coles adjusted Poisson process. Estimated expected goals are {xgh}–{xga} in favour of a neutral observer. The implied probabilities are P(Home) {pH}%, P(Draw) {pD}%, P(Away) {pA}%. The model recommendation is {pred} at fair odds of {odds}, with {conf}% confidence.',
      why: 'Why {pred}?',
      formLabel: 'Form & context',
      injuriesLabel: 'Team news',
      formNote: 'Line-ups are confirmed roughly one hour before kick-off. Check the official club channels for late changes.',
      howTo: 'How to approach this pick',
      stakeNote: 'Odds move as teams are confirmed, so compare prices across bookmakers shortly before kick-off. Stake only what you are comfortable losing and never chase losses.',
      whereTo: 'Where to bet',
      whereNote: 'If you register as a new customer at {bookie} with code {code}, you can claim a welcome offer — but any licensed bookmaker works. Responsible gambling: 18+.',
      faq: 'Frequently asked questions',
      faq1: { q: 'Who is the statistical favourite in {home} vs {away}?', a: 'The Dixon-Coles model gives {home} a {pH}% chance, the draw {pD}% and {away} {pA}%. With expected goals of {xgh}–{xga}, the recommended pick is {pred} at fair odds of {odds} ({conf}% confidence).' },
      faq2: { q: 'Is this prediction guaranteed?', a: 'No. {pred} is a probability estimate, not a guarantee. Statistical models reduce risk but betting always involves uncertainty. Only bet what you can afford to lose.' },
      faq3: { q: 'When does {home} vs {away} kick off?', a: 'Kick-off: {precise}. {countdown}.' }
    },
    bet: {
      'Home Win': 'Bet on the home team to win in 90 minutes — market 1 on the 1X2.',
      'Draw': 'Bet on the draw at full time — market X. Usually priced higher, so it carries more value.',
      'Away Win': 'Bet on the away team to win in 90 minutes — market 2 on the 1X2.',
      'Over 2.5': 'Bet on three or more goals in the match (2-1, 3-0, 2-2 etc.).',
      'Under 2.5': 'Bet on two goals or fewer in the match (1-0, 0-0, 2-0, 1-1).',
      'BTTS Yes': 'Bet on both teams scoring at least one goal each.',
      'BTTS No': 'Bet on at least one team failing to score.'
    },
    predHub: {
      title: 'All football predictions today',
      desc: 'Every match prediction for today with the full market breakdown — 1X2, Double Chance, Over/Under 2.5, BTTS and correct score. {n} matches covered.',
      count: '{n} predicted matches',
      empty: 'No fixtures available right now. Real fixtures are added daily at 06:00 UTC — no invented matches.',
      group: 'Predictions by competition'
    },
    detail: {
      vs: 'vs', tag: 'XWHIZ STATISTICAL PICK', kickoff: 'Kick-off', matchday: 'Matchday', veg: 'All markets by our model',
      more: 'More predictions today',
      views: 'prediction pages'
    },
    live: {
      title: 'Live football scores',
      sub: 'Today\'s matches, Premier League table and top scorers — real data, refreshed daily.',
      allMatches: 'All matches', inPlay: 'In play', standings: 'Premier League table',
      scorers: 'Top scorers', mg: 'No live data right now — showing today\'s fixtures from football-data.org.'
    },
    predictor: {
      title: 'Free match predictor',
      sub: 'Pick any two teams and our Dixon-Coles statistical model returns instant probabilities for the 1X2, totals and both-teams-to-score markets. Runs entirely in your browser.',
      teamA: 'Home team', teamB: 'Away team', swap: 'Swap teams', calc: 'Run the model',
      resultTitle: 'Model output', predLine: 'Recommended pick', oddsTag: 'Fair odds', uncertainty: 'This is a probability estimate for information purposes only — betting is risk. 18+.',
      examples: 'Popular pairings', modelDesc: 'Method: Elo ratings → expected goals (Poisson with Dixon-Coles low-score correction) → full market probabilities.',
      placeholder: 'Start typing a team…', suggestions: 'Suggestions'
    },
    search: { title: 'Search XWhiz', placeholder: 'Search predictions, teams, news…', empty: 'Type at least two characters to search.', count: '{n} results for “{q}”', no: 'No results found for “{q}”. Try a team, competition or market.' },
    notFound: { title: 'Page not found', body: 'The page you requested does not exist. Head back to the homepage or browse today\'s predictions.', home: 'Homepage', predictions: 'Predictions' },
    football: {
      hubTitle: 'Football',
      hubDesc: 'Competitions, teams, fixtures, results and league tables from our daily real-data feed.',
      leagues: 'Leagues', teams: 'Teams', fixtures: 'Fixtures', results: 'Results',
      today: 'Today', tomorrow: 'Tomorrow', upcoming: 'Upcoming 7 days', finished: 'Finished',
      noMatches: 'No matches available for this view yet.',
      standingsNote: 'Free sports-data tier returns standings for a limited set of competitions.',
      overview: 'Overview', predictionsGroup: 'Prediction index'
    },
    news: { title: 'Sports news', desc: 'Football, tennis and basketball news, updated daily from public feeds.', cat: { football: 'Football news', tennis: 'Tennis news', basketball: 'Basketball news', all: 'All categories' }, read: 'Read article', by: 'Source' },
    rg: {
      block: 'Responsible gambling: our predictions are statistical analysis for information and entertainment — they are not a guarantee of profit. 18+. Never bet more than you can afford to lose.',
      help: 'BeGambleAware.org',
      affiliate: 'Affiliate disclosure: this site uses affiliate links. If you register via our Melbet links we may earn a commission at no extra cost to you. 18+ | Gamble responsibly'
    },
    footer: {
      blurb: 'Statistical football predictions, live scores and news — informative, free and built on real data.',
      colP: 'Predictions', colF: 'Football', colM: 'More',
      today: 'Today\'s predictions', over: 'Over 2.5 tips', btts: 'BTTS tips', predictor: 'Match predictor',
      leagues: 'Leagues', teams: 'Teams', fixtures: 'Fixtures', results: 'Results',
      live: 'Live scores', news: 'Sports news', search: 'Search', sitemap: 'Sitemap'
    },
    cta: { bet: 'Bet {pred} on Melbet', betHome: 'Bet on Melbet now', bonus: 'Promo code {code} · welcome bonus up to $130' },
    promo: { disclose: 'Affiliate link: we may earn a commission if you sign up via this link at no extra cost to you. 18+ only — gamble responsibly.' },
    odds: { at: 'at', from: 'from', vs: 'vs' }
  },

  fr: {
    meta: { lang: 'fr', dir: 'ltr', label: 'Français', font: 'Inter' },
    site: {
      name: 'XWhiz',
      tagline: 'Pronostics football statistiques et indépendants',
      suffix: '| XWhiz',
      home: { title: 'Pronostics Football Aujourd\'hui — Conseils Gratuits, Cotes et Scores en Direct | XWhiz', desc: 'Pronostics football gratuits du jour calculés par notre modèle statistique Dixon-Coles. 1N2, Plus/Moins 2,5 buts et « les deux équipes marquent » avec taux de confiance, cotes et scores en direct. Mis à jour chaque jour à 06h00 UTC.' }
    },
    nav: { predictions: 'Pronostics', football: 'Football', live: 'Direct', news: 'Actus', predictor: 'Pronostiqueur', search: 'Recherche' },
    topbar: { text: 'Pronostics football statistiques et indépendants · 18+ jouez responsable', bonus: 'Bonus Melbet' },
    hero: {
      badge: 'Mis à jour chaque jour à 06h00 UTC',
      h1: 'Pronostics football du jour, fondés sur les statistiques',
      sub: 'Notre modèle Dixon-Coles + Elo estime les buts attendus de chaque rencontre puis traduit ces données en probabilités 1N2, Plus/Moins 2,5 buts et « les deux équipes marquent ». Pas d\'impressions, que des maths.',
      cta1: 'Les pronostics du jour — gratuits',
      cta2: 'Scores en direct',
      trust: 'Gratuit · Indépendant · Mis à jour chaque jour · Jamais de faux matchs'
    },
    sec: {
      topPicks: 'Meilleurs pronostics du jour',
      latestPicks: 'Derniers pronostics',
      asOf: 'Données au {date} — actualisées chaque jour à 06:00 UTC',
      todayMatches: 'Matchs du jour',
      allCta: 'Tous les pronostics du jour',
      overCta: 'Pronostics Plus de 2,5',
      bttsCta: 'Pronostics Buteurs',
      liveTitle: 'Scores en direct du jour',
      liveEmpty: 'Aucun match en cours actuellement.',
      standings: 'Classement Premier League',
      scorers: 'Meilleurs buteurs',
      news: 'Dernières actualités',
      newsCta: 'Toutes les actus',
      leagues: 'Compétitions couvertes',
      howTitle: 'Comment nos pronostics sont calculés',
      how1: 'La force des équipes via les cotes Elo',
      how2: 'Buts attendus via un modèle de Poisson (Dixon-Coles)',
      how3: 'Probabilités pour tous les marchés, chaque jour',
      howBody: 'Chaque match est analysé comme un événement indépendant. Le modèle calcule la probabilité du 1N2, des totaux et des deux équipes marquent, plus un pronostic conseillé avec sa cote juste. Il s\'agit d\'une analyse statistique à but informatif, pas d\'une promesse de gain. 18+, jouez de manière responsable.',
      update: 'Mis à jour chaque jour à 06h00 UTC à partir de football-data.org.',
      dataNote: 'Seuls de vrais matchs — nous n\'affichons jamais de rencontres inventées.'
    },
    market: {
      _1x2: '1N2', dc: 'Double chance', ou: 'Plus / Moins 2,5 buts', btts: 'Les deux équipes marquent', cs: 'Score exact',
      home: 'Domicile', draw: 'Nul', away: 'Extérieur', over: 'Plus de 2,5', under: 'Moins de 2,5', yes: 'Oui', no: 'Non',
      conf: 'Confiance', value: 'Valeur', model: 'Modèle statistique', markets: 'Tous les marchés et cotes prévues',
      prob: 'Probabilité du modèle', pick: 'Prono / cote', updated: 'Dernière mise à jour'
    },
    status: { scheduled: 'Programmé', finished: 'Terminé', live: 'En direct', ht: 'Mi-temps', ft: 'Temps plein', postponed: 'Reporté', cancelled: 'Annulé', timed: 'Programmé' },
    analysis: {
      title: 'Analyse du pronostic',
      intro: 'Nous modélisons le match {home} – {away} (Compétition : {league}) avec un processus de Poisson ajusté à la Dixon-Coles. Les buts attendus estimés sont de {xgh}–{xga}. Les probabilités implicites sont P(Domicile) {pH}%, P(Nul) {pD}%, P(Extérieur) {pA}%. Le pronostic conseillé est {pred} à une cote juste de {odds}, avec {conf}% de confiance.',
      why: 'Pourquoi {pred} ?',
      formLabel: 'Forme et contexte',
      injuriesLabel: 'Compositions',
      formNote: 'Les compositions sont confirmées environ une heure avant le coup d\'envoi. Consultez les canaux officiels des clubs pour les changements de dernière minute.',
      howTo: 'Comment aborder ce pronostic',
      stakeNote: 'Les cotes évoluent à la confirmation des équipes. Comparez les prix des bookmakers juste avant le coup d\'envoi. Ne misez que ce que vous pouvez vous permettre de perdre.',
      whereTo: 'Où parier',
      whereNote: 'En vous inscrivant comme nouveau client chez {bookie} avec le code {code}, vous pouvez prétendre à une offre de bienvenue — mais tout bookmaker agréé fait l\'affaire. Jeu responsable : 18+.',
      faq: 'Questions fréquentes',
      faq1: { q: 'Qui est favori statistiquement dans {home} – {away} ?', a: 'Le modèle Dixon-Coles donne {pH}% à {home}, {pD}% au nul et {pA}% à {away}. Avec {xgh}–{xga} buts attendus, le pronostic conseillé est {pred} à la cote {odds} ({conf}% de confiance).' },
      faq2: { q: 'Ce pronostic est-il garanti ?', a: 'Non. {pred} est une estimation de probabilité, pas une garantie. Les modèles statistiques réduisent le risque mais le pari comporte toujours une part d\'incertitude. Ne pariez que ce que vous pouvez perdre.' },
      faq3: { q: 'Quand a lieu le coup d\'envoi de {home} – {away} ?', a: 'Coup d\'envoi : {precise}. {countdown}.' }
    },
    bet: {
      'Home Win': 'Pariez sur la victoire de l\'équipe à domicile dans le temps réglementaire — sélection 1 au 1N2.',
      'Draw': 'Pariez sur le match nul à temps plein — sélection N. Souvent mieux coté, donc plus de valeur.',
      'Away Win': 'Pariez sur la victoire de l\'équipe à l\'extérieur dans le temps réglementaire — sélection 2 au 1N2.',
      'Over 2.5': 'Pariez sur trois buts ou plus dans le match (2-1, 3-0, 2-2, etc.).',
      'Under 2.5': 'Pariez sur deux buts ou moins (1-0, 0-0, 2-0, 1-1).',
      'BTTS Yes': 'Pariez sur au moins un but marqué par chaque équipe.',
      'BTTS No': 'Pariez sur au moins une équipe qui ne marque pas.'
    },
    predHub: {
      title: 'Tous les pronostics football du jour',
      desc: 'Tous les pronostics de matchs du jour avec le détail complet des marchés — 1N2, double chance, plus/moins 2,5 buts, buteurs et score exact. {n} matchs couverts.',
      count: '{n} matchs pronostiqués',
      empty: 'Aucune rencontre disponible pour le moment. De vrais matchs sont ajoutés chaque jour à 06h00 UTC — jamais de rencontres inventées.',
      group: 'Pronostics par compétition'
    },
    detail: {
      vs: '–', tag: 'PRONO STATISTIQUE XWHIZ', kickoff: 'Coup d\'envoi', matchday: 'Journée',
      more: 'Plus de pronostics aujourd\'hui', views: 'pages de pronostics'
    },
    live: {
      title: 'Scores de football en direct',
      sub: 'Matchs du jour, classement de la Premier League et meilleurs buteurs — de vraies données, chaque jour.',
      allMatches: 'Tous les matchs', inPlay: 'En direct', standings: 'Classement Premier League',
      scorers: 'Meilleurs buteurs', mg: 'Pas de données en direct pour l\'instant — voici les matchs du jour (football-data.org).'
    },
    predictor: {
      title: 'Pronostiqueur de matchs gratuit',
      sub: 'Choisissez deux équipes et notre modèle statistique Dixon-Coles calcule instantanément les probabilités 1N2, totaux et « les deux équipes marquent ». Tout se passe dans votre navigateur.',
      teamA: 'Équipe à domicile', teamB: 'Équipe à l\'extérieur', swap: 'Inverser', calc: 'Lancer le modèle',
      resultTitle: 'Résultat du modèle', predLine: 'Pronostic conseillé', oddsTag: 'Cote juste',
      uncertainty: 'Ceci est une estimation de probabilité à but informatif — parier comporte un risque. 18+.',
      examples: 'Affrontements populaires', modelDesc: 'Méthode : cotes Elo → buts attendus (Poisson avec correction Dixon-Coles) → probabilités complètes.',
      placeholder: 'Commencez à taper une équipe…', suggestions: 'Suggestions'
    },
    search: { title: 'Rechercher sur XWhiz', placeholder: 'Rechercher pronostics, équipes, actus…', empty: 'Tapez au moins deux caractères pour lancer la recherche.', count: '{n} résultats pour « {q} »', no: 'Aucun résultat pour « {q} ». Essayez une équipe, une compétition ou un marché.' },
    notFound: { title: 'Page introuvable', body: 'La page demandée n\'existe pas. Revenez à l\'accueil ou parcourez les pronostics du jour.', home: 'Accueil', predictions: 'Pronostics' },
    football: {
      hubTitle: 'Football',
      hubDesc: 'Compétitions, équipes, calendrier, résultats et classements issus de notre flux quotidien de données réelles.',
      leagues: 'Ligues', teams: 'Équipes', fixtures: 'Calendrier', results: 'Résultats',
      today: 'Aujourd\'hui', tomorrow: 'Demain', upcoming: 'Prochains 7 jours', finished: 'Terminés',
      noMatches: 'Aucun match disponible pour le moment.',
      standingsNote: 'L\'offre gratuite de données sportives ne renvoie les classements que pour un nombre limité de compétitions.',
      overview: 'Aperçu', predictionsGroup: 'Index des pronostics'
    },
    news: { title: 'Actualités sportives', desc: 'Actualités football, tennis et basket mises à jour chaque jour à partir de flux publics.', cat: { football: 'Football', tennis: 'Tennis', basketball: 'Basket', all: 'Toutes les catégories' }, read: 'Lire l\'article', by: 'Source' },
    rg: {
      block: 'Jeu responsable : nos pronostics sont une analyse statistique informative — ils ne garantissent aucun gain. 18+. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre.',
      help: 'BeGambleAware.org',
      affiliate: 'Divulgation d\'affiliation : ce site utilise des liens affiliés. Si vous vous inscrivez via nos liens Melbet, nous pouvons percevoir une commission sans frais supplémentaires pour vous. 18+ | Jouez responsablement.'
    },
    footer: {
      blurb: 'Pronostics football statistiques, scores en direct et actualités — informatifs, gratuits et fondés sur de vraies données.',
      colP: 'Pronostics', colF: 'Football', colM: 'Plus',
      today: 'Pronostics du jour', over: 'Plus de 2,5 buts', btts: 'Buteurs (BTTS)', predictor: 'Pronostiqueur',
      leagues: 'Ligues', teams: 'Équipes', fixtures: 'Calendrier', results: 'Résultats',
      live: 'Direct', news: 'Actualités', search: 'Recherche', sitemap: 'Plan du site'
    },
    cta: { bet: 'Parier {pred} chez Melbet', betHome: 'Pariez sur Melbet maintenant', bonus: 'Code promo {code} · bonus de bienvenue jusqu\'à 130 $' },
    promo: { disclose: 'Lien d\'affiliation : nous pouvons percevoir une commission si vous vous inscrivez via ce lien, sans frais supplémentaires pour vous. Réservé aux 18+ — jouez responsable.' },
    odds: { at: 'à', from: 'de', vs: '–' }
  },

  ar: {
    meta: { lang: 'ar', dir: 'rtl', label: 'العربية', font: 'Tajawal' },
    site: {
      name: 'XWhiz',
      tagline: 'توقعات كرة القدم الإحصائية المستقلة',
      suffix: '| XWhiz',
      home: { title: 'توقعات مباريات اليوم — توقعات مجانية واحتمالات ونتائج مباشرة | XWhiz', desc: 'توقعات كرة القدم المجانية اليوم وفق نموذجنا الإحصائي Dixon-Coles. توقعات 1X2 وأكثر/أقل من 2.5 هدف وكلا الفريقين يسجلان مع نسب الثقة والاحتمالات والنتائج المباشرة. تُحدَّث يوميًا في الساعة 06:00 بالتوقيت العالمي.' }
    },
    nav: { predictions: 'التوقعات', football: 'كرة القدم', live: 'النتائج المباشرة', news: 'الأخبار', predictor: 'مُنبّئ المباريات', search: 'بحث' },
    topbar: { text: 'توقعات كرة القدم الإحصائية المستقلة · 18+ العب بمسؤولية', bonus: 'مكافأة Melbet' },
    hero: {
      badge: 'تُحدَّث يوميًا في الساعة 06:00 بتوقيت غرينتش',
      h1: 'توقعات مباريات اليوم، مدعومة بالإحصاءات',
      sub: 'يعمل نموذجنا Dixon-Coles + Elo على تقدير الأهداف المتوقعة في كل مباراة ثم تحويلها إلى احتمالات لسوق 1X2 وأكثر/أقل من 2.5 هدف وكلا الفريقين يسجلان. لا حظوظ ولا تخمينات — فقط أرقام.',
      cta1: 'توقعات اليوم مجانًا',
      cta2: 'النتائج المباشرة',
      trust: 'مجاني · مستقل · يُضاف يوميًا · لا مباريات مختلَقة أبدًا'
    },
    sec: {
      topPicks: 'أبرز توقعات اليوم',
      latestPicks: 'أحدث التوقعات',
      asOf: 'البيانات حتى {date} — تُحدَّث يومياً الساعة 06:00 UTC',
      todayMatches: 'مباريات اليوم',
      allCta: 'جميع توقعات اليوم',
      overCta: 'أكثر من 2.5 هدف',
      bttsCta: 'كلا الفريقين يسجلان',
      liveTitle: 'النتائج المباشرة اليوم',
      liveEmpty: 'لا توجد مباريات تُلعب الآن.',
      standings: 'ترتيب الدوري الإنجليزي الممتاز',
      scorers: 'الهدافون',
      news: 'آخر الأخبار',
      newsCta: 'جميع الأخبار',
      leagues: 'المسابقات المشمولة',
      howTitle: 'كيف تُحسب توقعاتنا؟',
      how1: 'قوة الفريق من تصنيفات Elo',
      how2: 'الأهداف المتوقعة من نموذج بواسون (Dixon-Coles)',
      how3: 'احتمالات جميع الأسواق، تُحدَّث يوميًا',
      howBody: 'تُقيَّم كل مباراة كحدث مستقل. يحسب النموذج احتمال نتيجة 1X2 والأهداف الإجمالية وكلا الفريقين يسجلان، مع التوقع الموصى به وسعره العادل. هذا تحليل إحصائي لأغراض إعلامية فقط، وليس وعدًا بالربح. 18+، العب بمسؤولية.',
      update: 'تُحدَّث يوميًا في الساعة 06:00 بتوقيت غرينتش من football-data.org.',
      dataNote: 'مباريات حقيقية فقط — لا نعرض أبدًا مباريات مختلَقة.'
    },
    market: {
      _1x2: '1X2', dc: 'فرصة مزدوجة', ou: 'أكثر / أقل من 2.5 هدف', btts: 'كلا الفريقين يسجلان', cs: 'النتيجة الصحيحة',
      home: 'فوز صاحب الأرض', draw: 'تعادل', away: 'فوز خارج الأرض', over: 'أكثر من 2.5', under: 'أقل من 2.5', yes: 'نعم', no: 'لا',
      conf: 'الثقة', value: 'القيمة', model: 'نموذج إحصائي', markets: 'جميع الأسواق والاحتمالات المتوقعة',
      prob: 'احتمال النموذج', pick: 'التوقع / الاحتمالات', updated: 'آخر تحديث'
    },
    status: { scheduled: 'مجدولة', finished: 'انتهت', live: 'مباشرة الآن', ht: 'استراحة', ft: 'انتهت', postponed: 'مؤجلة', cancelled: 'ملغاة', timed: 'مجدولة' },
    analysis: {
      title: 'تحليل التوقع',
      intro: 'نموذجنا، وهو عملية بواسون معدَّلة بطريقة Dixon-Coles، يقيّم مباراة {home} ضد {away} (المسابقة: {league}). الأهداف المتوقعة المقدرة هي {xgh}–{xga}. الاحتمالات المستنتجة: فوز {home} {pH}%، التعادل {pD}%، فوز {away} {pA}%. التوقع الموصى به هو {pred} بسعر عادل {odds} مع ثقة {conf}%.',
      why: 'لماذا {pred}؟',
      formLabel: 'السياق والتشكيلة',
      injuriesLabel: 'أخبار الفريق',
      formNote: 'تُعلَن التشكيلات قبل انطلاق المباراة بحوالي ساعة. تابع القنوات الرسمية للأندية لمعرفة أي تغييرات متأخرة.',
      howTo: 'كيف تتعامل مع هذا التوقع',
      stakeNote: 'تتغير الاحتمالات عند تأكيد التشكيلات، لذا قارن الأسعار لدى وكلاء المراهنات قبل الانطلاق مباشرة. راهن فقط بما لا تتحمل خسارته.',
      whereTo: 'أين تراهن',
      whereNote: 'بالتسجيل كعميل جديد لدى {bookie} باستخدام الرمز {code} يمكنك الحصول على مكافأة ترحيب — لكن أي وكيل مراهنات مرخّص يصلح. اللعب المسؤول: ينطبق على 18+.',
      faq: 'الأسئلة الشائعة',
      faq1: { q: 'من هو المرشح إحصائيًا في مباراة {home} ضد {away}؟', a: 'يمنح نموذج Dixon-Coles {home} احتمال {pH}% والتعادل {pD}% و{away} {pA}%. مع أهداف متوقعة {xgh}–{xga}، التوقع الموصى به هو {pred} بسعر {odds} (ثقة {conf}%).' },
      faq2: { q: 'هل هذا التوقع مضمون؟', a: 'لا. {pred} تقدير احتمالي وليس ضمانًا. النماذج الإحصائية تقلل المخاطر لكن المراهنة تنطوي دائمًا على عدم يقين. راهن فقط بما يمكنك تحمّل خسارته.' },
      faq3: { q: 'متى تنطلق مباراة {home} و{away}؟', a: 'الانطلاق: {precise}. {countdown}.' }
    },
    bet: {
      'Home Win': 'راهن على فوز الفريق المستضيف في الوقت الأصلي — الخيار 1 في سوق 1X2.',
      'Draw': 'راهن على التعادل بنهاية الوقت الأصلي — الخيار X. عادة يكون بسعر أعلى، لذا فهو ذو قيمة أكبر.',
      'Away Win': 'راهن على فوز الفريق الضيف في الوقت الأصلي — الخيار 2 في سوق 1X2.',
      'Over 2.5': 'راهن على ثلاثة أهداف أو أكثر في المباراة (2-1، 3-0، 2-2 …).',
      'Under 2.5': 'راهن على هدفين أو أقل (1-0، 0-0، 2-0، 1-1).',
      'BTTS Yes': 'راهن على تسجيل كل فريق هدفًا واحدًا على الأقل.',
      'BTTS No': 'راهن على فشل فريق واحد على الأقل في التسجيل.'
    },
    predHub: {
      title: 'جميع توقعات مباريات اليوم',
      desc: 'كل توقعات مباريات اليوم مع التفاصيل الكاملة للأسواق — 1X2، فرصة مزدوجة، أكثر/أقل من 2.5 هدف، كلا الفريقين يسجلان والنتيجة الصحيحة. يغطي {n} مباراة.',
      count: '{n} مباراة متوقعة',
      empty: 'لا توجد مباريات متاحة حاليًا. تُضاف المباريات الحقيقية يوميًا الساعة 06:00 بتوقيت غرينتش — لا مباريات مختلَقة.',
      group: 'التوقعات حسب المسابقة'
    },
    detail: {
      vs: 'ضد', tag: 'توقع XWHIZ الإحصائي', kickoff: 'الانطلاق', matchday: 'الجولة',
      more: 'المزيد من توقعات اليوم', views: 'صفحات التوقعات'
    },
    live: {
      title: 'نتائج مباريات كرة القدم المباشرة',
      sub: 'مباريات اليوم وترتيب الدوري الإنجليزي الممتاز والهدافون — بيانات حقيقية تُحدَّث يوميًا.',
      allMatches: 'جميع المباريات', inPlay: 'تُلعب الآن', standings: 'ترتيب الدوري الإنجليزي الممتاز',
      scorers: 'الهدافون', mg: 'لا توجد بيانات مباشرة الآن — هذه مباريات اليوم من football-data.org.'
    },
    predictor: {
      title: 'مُنَبّئ المباريات المجاني',
      sub: 'اختر أي فريقين وسيحسب نموذجنا الإحصائي Dixon-Coles على الفور احتمال نتيجتي 1X2 والأهداف الإجمالية وكلا الفريقين يسجلان. يعمل كليًا داخل متصفحك.',
      teamA: 'الفريق المستضيف', teamB: 'الفريق الضيف', swap: 'تبديل الفريقين', calc: 'تشغيل النموذج',
      resultTitle: 'نتيجة النموذج', predLine: 'التوقع الموصى به', oddsTag: 'السعر العادل',
      uncertainty: 'هذا تقدير احتمالي لأغراض إعلامية فقط — المراهنة تنطوي على مخاطر. 18+.',
      examples: 'مواجهات شائعة', modelDesc: 'الطريقة: تصنيفات Elo ← الأهداف المتوقعة (بواسون مع تصحيح Dixon-Coles) ← احتمالات جميع الأسواق.',
      placeholder: 'ابدأ بكتابة اسم الفريق…', suggestions: 'اقتراحات'
    },
    search: { title: 'ابحث في XWhiz', placeholder: 'ابحث في التوقعات والفرق والأخبار…', empty: 'اكتب حرفين على الأقل لبدء البحث.', count: '{n} نتيجة لـ «{q}»', no: 'لا توجد نتائج لـ «{q}». جرّب فريقًا أو مسابقة أو سوقًا آخر.' },
    notFound: { title: 'الصفحة غير موجودة', body: 'الصفحة التي طلبتها غير موجودة. عد إلى الصفحة الرئيسية أو تصفّح توقعات اليوم.', home: 'الصفحة الرئيسية', predictions: 'التوقعات' },
    football: {
      hubTitle: 'كرة القدم',
      hubDesc: 'المسابقات والفرق والمباريات والنتائج وجدول الترتيب من بياناتنا الحقيقية اليومية.',
      leagues: 'الدوريات', teams: 'الفرق', fixtures: 'المباريات', results: 'النتائج',
      today: 'اليوم', tomorrow: 'غدًا', upcoming: 'السبعة أيام القادمة', finished: 'المنتهية',
      noMatches: 'لا توجد مباريات في هذا القسم حاليًا.',
      standingsNote: 'خدمة البيانات الرياضية المجانية توفر الترتيب لعدد محدود من المسابقات.',
      overview: 'نظرة عامة', predictionsGroup: 'فهرس التوقعات'
    },
    news: { title: 'الأخبار الرياضية', desc: 'أخبار كرة القدم والتنس وكرة السلة تُحدَّث يوميًا من مصادر عامة.', cat: { football: 'أخبار كرة القدم', tennis: 'أخبار التنس', basketball: 'أخبار كرة السلة', all: 'جميع الفئات' }, read: 'اقرأ المقال', by: 'المصدر' },
    rg: {
      block: 'اللعب المسؤول: توقعاتنا تحليل إحصائي لأغراض إعلامية وترفيهية — وليست ضمانًا للربح. 18+. لا تراهن أبدًا بأكثر مما يمكنك تحمّل خسارته.',
      help: 'BeGambleAware.org',
      affiliate: 'إفصاح تابع: يستخدم الموقع روابط تابعة. إذا سجّلت عبر روابطنا لـ Melbet فقد نكسب عمولة دون أي تكلفة إضافية عليك. 18+ | العب بمسؤولية.'
    },
    footer: {
      blurb: 'توقعات كرة القدم الإحصائية والنتائج المباشرة والأخبار — معلوماتية ومجانية ومبنية على بيانات حقيقية.',
      colP: 'التوقعات', colF: 'كرة القدم', colM: 'المزيد',
      today: 'توقعات اليوم', over: 'أكثر من 2.5 هدف', btts: 'كلا الفريقين يسجلان', predictor: 'مُنبّئ المباريات',
      leagues: 'الدوريات', teams: 'الفرق', fixtures: 'المباريات', results: 'النتائج',
      live: 'النتائج المباشرة', news: 'الأخبار الرياضية', search: 'البحث', sitemap: 'خريطة الموقع'
    },
    cta: { bet: 'اراهن بـ {pred} على Melbet', betHome: 'اراهن على Melbet الآن', bonus: 'رمز الترويج {code} · مكافأة ترحيب حتى 130$' },
    promo: { disclose: 'رابط إحالة: قد نحصل على عمولة إذا سجّلت عبر هذا الرابط دون أي تكلفة إضافية عليك. للمراهنين 18+ فقط — العب بمسؤولية.' },
    odds: { at: 'عند', from: 'من', vs: 'ضد' }
  }
};

module.exports = L;