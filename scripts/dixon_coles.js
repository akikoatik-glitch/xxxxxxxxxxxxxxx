// Dixon-Coles + Elo ported from aaronsun0811-dot/football-predictor to Node
// Simplified but pro-level: Elo -> expected goals -> Dixon-Coles low-score correction -> probabilities

const ELO = {
  // Base Elo for top teams (approx from eloratings.net)
  "Man City": 2050, "Arsenal": 2000, "Liverpool": 1980, "Chelsea": 1850, "Man Utd": 1820, "Tottenham": 1800,
  "Real Madrid": 2030, "Barcelona": 1980, "Atletico": 1850, "Sevilla": 1750,
  "Bayern Munich": 2000, "Dortmund": 1860, "Leipzig": 1820, "Leverkusen": 1880,
  "Inter": 1920, "AC Milan": 1880, "Juventus": 1870, "Roma": 1800, "Napoli": 1850,
  "PSG": 1950, "Marseille": 1750, "Lyon": 1720, "Monaco": 1760,
  "Benfica": 1800, "Porto": 1780, "Ajax": 1750, "Feyenoord": 1700,
  "RC Celta de Vigo": 1720, "CA Osasuna": 1680, "FC Barcelona": 1980, "Athletic Club": 1780,
};
function getElo(team){ return ELO[team] || 1700; }

function expectedGoals(eloHome, eloAway, homeAdv=100){
  const diff = (eloHome + homeAdv - eloAway) / 400;
  const expHome = 1.4 * Math.pow(10, diff/2); // base 1.4 goals
  const expAway = 1.2 * Math.pow(10, -diff/2);
  return [Math.max(0.6, expHome), Math.max(0.5, expAway)];
}
function poisson(k, lambda){
  let p = Math.exp(-lambda);
  for(let i=1;i<=k;i++) p *= lambda / i;
  return p;
}
function dixonColes(homeLambda, awayLambda, rho=0.13){
  // Correction for 0-0,1-0,0-1,1-1
  const probs = Array(5).fill(0).map(()=>Array(5).fill(0));
  for(let i=0;i<5;i++) for(let j=0;j<5;j++){
    let p = poisson(i, homeLambda) * poisson(j, awayLambda);
    if(i===0 && j===0) p *= 1 - homeLambda*awayLambda*rho;
    else if(i===1 && j===0) p *= 1 + awayLambda*rho;
    else if(i===0 && j===1) p *= 1 + homeLambda*rho;
    else if(i===1 && j===1) p *= 1 - rho;
    probs[i][j]=p;
  }
  return probs;
}
function predict(home, away){
  const eloH=getElo(home), eloA=getElo(away);
  const [lamH, lamA]=expectedGoals(eloH, eloA);
  const probs=dixonColes(lamH, lamA);
  let pH=0,pD=0,pA=0;
  for(let i=0;i<5;i++) for(let j=0;j<5;j++){
    if(i>j) pH+=probs[i][j];
    else if(i===j) pD+=probs[i][j];
    else pA+=probs[i][j];
  }
  const total=pH+pD+pA;
  pH/=total; pD/=total; pA/=total;
  // Choose best market
  let pred, sub, conf, odds;
  if(pH>pD && pH>pA){ pred='Home Win'; sub='1 • Full Time'; conf=Math.round(62+pH*20); odds=(1/pH).toFixed(2); }
  else if(pA>pH && pA>pD){ pred='Away Win'; sub='2 • Full Time'; conf=Math.round(62+pA*20); odds=(1/pA).toFixed(2); }
  else if(pD>0.28){ pred='Draw'; sub='X • Full Time'; conf=Math.round(60+pD*25); odds=(1/pD).toFixed(2); }
  else { // fallback to goals
    const overProb = 1 - (probs[0][0]+probs[1][0]+probs[0][1]+probs[1][1]+probs[2][0]+probs[0][2]);
    if(overProb>0.55){ pred='Over 2.5'; sub='Goals'; conf=Math.round(62+overProb*18); odds=(1/overProb).toFixed(2); }
    else { pred='BTTS Yes'; sub='Both to Score'; conf=74; odds='1.75'; }
  }
  // Clamp
  conf=Math.min(83, Math.max(62, conf));
  const value = `+${Math.round((conf-60)/2)}%`;
  return {pred, sub, conf, odds, value, pH:Math.round(pH*100), pD:Math.round(pD*100), pA:Math.round(pA*100), lamH:lamH.toFixed(2), lamA:lamA.toFixed(2)};
}
module.exports={predict};
