/**
 * Recomendação local de serviços: não usa IA nem envia dados para fora.
 * Compara o texto do cliente com os nomes e descrições dos serviços do estúdio,
 * entendendo sinónimos comuns (costas, stress, pernas pesadas, pele, unhas, ...).
 */

export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  name_en?: string | null;
  description_en?: string | null;
};

export type LocalRecommendation = {
  ok: boolean;
  error?: string;
  summary?: string;
  items?: { serviceId: string; name: string; reason: string }[];
  healthNote?: string;
};

type Concept = { pt: string; en: string; user: string[]; service: string[] };

// Raízes (sem acentos, minúsculas). "user" = palavras que o cliente usa; "service" = palavras que
// aparecem nos serviços que ajudam nessa necessidade. A correspondência é por início de palavra.
const CONCEPTS: Concept[] = [
  {
    pt: "dores musculares e tensão",
    en: "muscle pain and tension",
    user: ["costas", "coluna", "lombar", "ombro", "pescoc", "cervical", "nuca", "contratur", "tensao", "tenso", "muscul", "rigid", "torcicol", "back", "neck", "shoulder", "muscle", "tension", "stiff", "sore"],
    service: ["massagem", "massage", "descontratan", "muscul", "terapeut", "therap", "shiatsu", "desportiv", "sport", "tecidos", "deep", "quiropr", "relax", "pedras", "stone"],
  },
  {
    pt: "relaxamento e stress",
    en: "relaxation and stress",
    user: ["stress", "estress", "ansied", "cansac", "cansad", "esgot", "insoni", "dormir", "sono", "nervos", "burnout", "relax", "descans", "calma", "pressao", "anxi", "tired", "exhaust", "sleep", "calm", "unwind", "overwhelm"],
    service: ["relax", "massagem", "massage", "aroma", "spa", "bem-estar", "wellness", "ritual", "calm", "reflex", "descontrac", "sono", "sleep", "pedras", "stone"],
  },
  {
    pt: "pernas pesadas, inchaço e circulação",
    en: "heavy legs, swelling and circulation",
    user: ["pernas", "inchac", "inchad", "retenc", "circulac", "liquid", "varizes", "pesad", "legs", "swell", "puffy", "retention", "circulation", "heavy"],
    service: ["drenag", "drain", "linfat", "lymph", "pressoter", "circulat", "modelador", "anticelul"],
  },
  {
    pt: "celulite e modelação do corpo",
    en: "cellulite and body contouring",
    user: ["celulit", "gordura", "barriga", "abdom", "medidas", "emagrec", "modelar", "contorno", "flacid", "firmeza", "culote", "cellulit", "fat", "belly", "slim", "contour", "firm", "tone", "toning", "sagging"],
    service: ["modelador", "modela", "redutor", "cavitac", "radiofrequ", "lipo", "corporal", "body", "anticelul", "madero", "firmeza", "firming", "slimming", "contour", "contorno"],
  },
  {
    pt: "cuidados com o rosto e a pele",
    en: "face and skin care",
    user: ["rosto", "pele", "acne", "ruga", "manchas", "oleos", "hidrat", "envelhec", "brilho", "poros", "cravos", "facial", "cara", "rejuven", "luminos", "face", "skin", "wrinkle", "pimple", "dry", "oily", "aging", "ageing", "glow", "blemish"],
    service: ["facial", "face", "rosto", "limpeza de pele", "skin", "peeling", "hidraf", "hydraf", "rejuven", "microneedl", "dermapen", "anti-age", "antiage", "hidrat", "hydrat", "luminos", "glow", "acne"],
  },
  {
    pt: "depilação",
    en: "hair removal",
    user: ["depil", "pelos", "pelo ", "laser", "cera", "buco", "axilas", "virilha", "wax", "hair removal", "shave", "shaving", "bikini", "armpit", "unwanted hair"],
    service: ["depil", "laser", "cera", "wax", "pelos", "hair removal"],
  },
  {
    pt: "unhas",
    en: "nails",
    user: ["unha", "manicur", "pedicur", "verniz", "gel", "acrilic", "nail", "polish", "manicure", "pedicure"],
    service: ["unha", "manicur", "pedicur", "gel", "verniz", "acrilic", "nail", "polish"],
  },
  {
    pt: "sobrancelhas e olhar",
    en: "eyebrows and eyes",
    user: ["sobrancelh", "pestana", "olhar", "olhos", "brow", "lash", "eyebrow", "eyelash", "eyes"],
    service: ["sobrancelh", "pestana", "brow", "lash", "olhar", "eyebrow", "eyelash", "design"],
  },
  {
    pt: "pés",
    en: "feet",
    user: ["pes ", "calos", "calo ", "reflexolog", "plantar", "feet", "foot", "reflexolog", "callus"],
    service: ["pedicur", "reflex", "pes ", "pes,", "foot", "feet", "plantar"],
  },
  {
    pt: "gravidez e pós-parto",
    en: "pregnancy and postpartum",
    user: ["gravid", "gestante", "pos-parto", "pos parto", "puerp", "bebe", "amament", "pregnan", "postpartum", "breastfeed", "maternity", "newborn"],
    service: ["gravid", "pre-natal", "prenatal", "pos-parto", "pos parto", "maternid", "pregnan", "postpartum", "maternity"],
  },
  {
    pt: "cabelo e couro cabeludo",
    en: "hair and scalp",
    user: ["cabelo", "couro", "capilar", "caspa", "queda de cabelo", "hair", "scalp", "dandruff", "hair loss"],
    service: ["capilar", "cabelo", "couro", "scalp", "hair"],
  },
  {
    pt: "ocasião especial",
    en: "a special occasion",
    user: ["noiva", "casamento", "festa", "evento", "batizado", "formatura", "bride", "wedding", "party", "event", "prom", "graduation"],
    service: ["noiva", "casamento", "maquilh", "makeup", "make-up", "penteado", "bridal", "wedding", "evento", "event"],
  },
  {
    pt: "presente ou momento a dois",
    en: "a gift or a moment for two",
    user: ["presente", "oferta", "vale", "casal", "aniversario", "prenda", "gift", "voucher", "couple", "birthday", "present"],
    service: ["casal", "couple", "presente", "gift", "vale", "voucher", "pack", "duo"],
  },
  {
    pt: "bronzeado",
    en: "tanning",
    user: ["bronze", "moreno", "tan ", "tanning", "sunless"],
    service: ["bronze", "tan", "tanning", "sunless"],
  },
];

// Palavras que pedem cautela: devolvem sempre um aviso para falar com o profissional.
const HEALTH_RE =
  /\b(dor|dores|doi|doem|lesao|lesoes|lesionei|lesionad|gravid|gestante|cirurgia|operac|operei|medicac|medicament|doenc|hernia|diabet|cancro|tromb|varizes|inflam|febre|alergi|hipertens|fratura|torcao|ferida|infec|pos-operat|pain|hurt|hurts|injur|pregnan|surgery|surgical|medicat|disease|diabet|cancer|thromb|varicose|inflam|fever|allerg|hypertens|fracture|sprain|wound|infection)/;

const STOPWORDS = new Set(
  (
    "para com sem uma uns umas dos das nos nas por que como mas mais muito muita muitos muitas tenho tinha " +
    "estou estar esta este isto isso aqui ali quero queria gostava gostaria preciso preciso queria " +
    "fazer algo alguma algum qualquer sobre desde entre ainda tambem quando onde porque seja " +
    "the and for with that this have has had want wanted need would like some any about from also when where because " +
    "please reply english my your very much been being are was were can could should"
  ).split(" "),
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startsWithWord(haystack: string, root: string): boolean {
  const r = root.endsWith(" ") ? root.trimEnd() : root;
  const exact = root.endsWith(" ");
  const idx = ` ${haystack}`;
  const needle = ` ${r}`;
  let pos = idx.indexOf(needle);
  while (pos !== -1) {
    if (!exact) return true;
    const after = idx[pos + needle.length];
    if (after === undefined || after === " ") return true;
    pos = idx.indexOf(needle, pos + 1);
  }
  return false;
}

function tokens(text: string): string[] {
  return [...new Set(normalize(text).split(" ").filter((t) => t.length >= 4 && !STOPWORDS.has(t)))];
}

export function recommendLocally(rawNeeds: string, services: CatalogService[]): LocalRecommendation {
  const english = /\(please reply in english\.?\)/i.test(rawNeeds);
  const needs = rawNeeds.replace(/\(please reply in english\.?\)/gi, "").trim();
  const n = normalize(needs);
  const userTokens = tokens(needs);

  const activeConcepts = CONCEPTS.filter((c) => c.user.some((r) => startsWithWord(n, r)));

  const scored = services.map((s) => {
    const nameText = normalize(`${s.name} ${s.name_en ?? ""}`);
    const fullText = normalize(`${s.name} ${s.description ?? ""} ${s.name_en ?? ""} ${s.description_en ?? ""}`);
    let score = 0;
    const labels: string[] = [];
    const matchedWords: string[] = [];

    for (const c of activeConcepts) {
      if (c.service.some((r) => startsWithWord(fullText, r))) {
        score += 4;
        labels.push(english ? c.en : c.pt);
      }
    }
    for (const t of userTokens) {
      const root = t.length > 6 ? t.slice(0, 6) : t;
      if (startsWithWord(fullText, root)) {
        score += startsWithWord(nameText, root) ? 3 : 2;
        matchedWords.push(t);
      }
    }
    return { s, score, labels, matchedWords };
  });

  const candidates = scored.filter((x) => x.score >= 2);
  // Se algum serviço responde diretamente à necessidade descrita, ignora os que só partilham uma palavra solta.
  const byConcept = candidates.filter((x) => x.labels.length > 0);
  const best = (byConcept.length ? byConcept : candidates)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    .slice(0, 3);

  const needsHealthNote = HEALTH_RE.test(n);
  const healthNote = needsHealthNote
    ? english
      ? "Since you mentioned a health concern, please talk to the professional (and a doctor if needed) before your session."
      : "Como mencionou uma questão de saúde, fale com o profissional (e com um médico, se necessário) antes da sua sessão."
    : english
      ? "If you have any health doubts, talk to the professional before your session."
      : "Em caso de dúvidas de saúde, fale com o profissional antes da sua sessão.";

  if (!best.length) {
    return {
      ok: false,
      error: english
        ? "We couldn't find a matching service. Try describing it differently, or browse the services list."
        : "Não encontrámos um serviço que combine. Tente descrever de outra forma ou veja a lista de serviços.",
    };
  }

  const items = best.map(({ s, labels, matchedWords }) => {
    const useEn = english && s.name_en;
    const name = useEn ? (s.name_en as string) : s.name;
    let reason: string;
    if (labels.length) {
      const first = labels[0];
      reason = english ? `Matches what you described: ${first}.` : `Combina com o que descreveu: ${first}.`;
    } else {
      const w = matchedWords.slice(0, 2).join(", ");
      reason = english ? `Related to what you mentioned (${w}).` : `Relacionado com o que mencionou (${w}).`;
    }
    return { serviceId: s.id, name, reason };
  });

  return {
    ok: true,
    summary: english
      ? "Based on what you described, these options may help:"
      : "Com base no que descreveu, estas opções do estúdio podem ajudar:",
    items,
    healthNote,
  };
}
