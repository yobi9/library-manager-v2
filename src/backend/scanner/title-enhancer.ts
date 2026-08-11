import path from "path";

const HIERARCHICAL_TYPES = new Set([
  "series", "series_anime", "series_sports", "series_deen",
  "series_ramadan", "series_tv", "series_learn", "series_kids",
  "series_doc", "music", "singer",
  "audio_deen",
]);

const TECH_WORDS: RegExp[] = [
  /\b(1080p|720p|4K|FHD|HD|WEB-DL|BluRay|x264|x265|HEVC|DDP|AAC)\b/gi,
  /\b(Full Match|Highlights)\s*/gi,
  /\b(UCL|Champions League)\s*/gi,
  /\b(WDTeam|ahdaf-kooora|ahdaf|kooora|yalla-shoot|goal)\b\.?/gi,
  /[._-](1080p|720p|FHD|HD)/gi,
];

const TEAM_TRANSLATIONS: Record<string, string> = {
  "Barcelona": "برشلونة",
  "Real Madrid": "ريال مدريد",
  "Atlético Madrid": "أتلتيكو مدريد",
  "Bayern Munich": "بايرن ميونخ",
  "Manchester City": "مانشستر سيتي",
  "Liverpool": "ليفربول",
  "Paris St Germain": "باريس سان جيرمان",
  "Newcastle United": "نيوكاسل يونايتد",
  "Arsenal": "آرسنال",
  "Chelsea": "تشلسي",
  "Tottenham": "توتنهام",
  "Atalanta": "أتالانتا",
  "Sporting Lisbon": "سبورتينغ لشبونة",
  "Galatasaray": "غلطة سراي",
};

const ROUND_MAP: Record<string, string> = {
  "16": "ثمن النهائي",
  "8": "ربع النهائي",
  "4": "نصف النهائي",
  "2": "النهائي",
};

export function cleanFileTitle(filename: string): string {
  let name = path.basename(filename, path.extname(filename));

  for (const regex of TECH_WORDS) {
    name = name.replace(regex, " ");
  }

  name = name.replace(/\s+/g, " ").trim();

  let teams = "";
  let round = "";
  let leg = "";

  const roundMatch = name.match(/Round of (\d+)\s*\((\d+)(?:nd|st|rd|th)\s*Leg\)/i);
  if (roundMatch) {
    const roundMatchVal = roundMatch[1]!;
    round = ROUND_MAP[roundMatchVal] || `دور الـ ${roundMatchVal}`;
    leg = roundMatch[2] === "1" ? "ذهاب" : "إياب";
    name = name.replace(roundMatch[0], "").trim();
  }

  if (!round) {
    const finalMatch = name.match(/(Quarter|Semi|Round of 16|Round of 8)\s*Final/i);
    if (finalMatch) {
      const map: Record<string, string> = {
        "Quarter": "ربع النهائي",
        "Semi": "نصف النهائي",
        "Round of 16": "ثمن النهائي",
        "Round of 8": "ربع النهائي",
      };
      for (const [eng, arab] of Object.entries(map)) {
        if (finalMatch[0].includes(eng)) {
          round = arab;
          break;
        }
      }
      name = name.replace(finalMatch[0], "").trim();
    }
  }

  const legMatch = name.match(/\((\d+)(?:st|nd|rd|th)\s*Leg\)/i);
  if (legMatch) {
    if (!leg) leg = legMatch[1] === "1" ? "ذهاب" : "إياب";
    name = name.replace(legMatch[0], "").trim();
  }

  const teamPattern = /([A-Za-z\u0600-\u06FF\s]+?)\s+(?:v|vs|ضد)\s+([A-Za-z\u0600-\u06FF\s]+?)(?:\s+|$)/i;
  const teamMatch = name.match(teamPattern);
  if (teamMatch) {
    let team1 = (teamMatch[1] ?? "").trim();
    let team2 = (teamMatch[2] ?? "").trim();
    team1 = TEAM_TRANSLATIONS[team1] || team1;
    team2 = TEAM_TRANSLATIONS[team2] || team2;
    teams = `${team1} ضد ${team2}`;
    name = name.replace(teamMatch[0], "").trim();
  }

  let finalTitle = "";
  if (teams) finalTitle += teams;
  if (round) finalTitle += (finalTitle ? " - " : "") + round;
  if (leg) finalTitle += (finalTitle ? " (" : "") + leg + (finalTitle ? ")" : "");

  if (!finalTitle && name.length > 0 && name.length < 100) {
    finalTitle = name;
  } else if (!finalTitle) {
    finalTitle = filename;
  }

  return finalTitle;
}

export function enhanceEpisodeTitle(
  filePath: string,
  libraryType: string,
  depth: number,
  defaultTitle: string,
): string {
  if (!HIERARCHICAL_TYPES.has(libraryType)) return defaultTitle;

  if (depth >= 3) {
    const parentDir = path.dirname(filePath);
    const intermediateName = path.basename(parentDir);
    if (
      intermediateName &&
      !/(1080p|720p|FHD|HD|ahdaf|kooora|WDTeam)/i.test(intermediateName)
    ) {
      const cleaned = cleanFileTitle(intermediateName + ".dummy");
      if (cleaned && cleaned.length < 150) return cleaned;
    }
  }

  if (depth === 2) {
    const cleaned = cleanFileTitle(defaultTitle);
    if (cleaned && cleaned.length > 0 && cleaned.length < 150) return cleaned;
  }

  return defaultTitle;
}
