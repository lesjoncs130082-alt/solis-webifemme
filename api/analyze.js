// Solis - agent de validation scientifique WebiFemme
// Recoit une fiche du Banc d'essai (Airtable) et renvoie une analyse structuree.
// Ne remplace jamais un avis medical ; ne transforme jamais une allegation
// fabricant en information de sante validee sans preuve independante.

const SYSTEM_PROMPT = "Tu es Solis, l'agent de validation scientifique de l'ecosysteme WebiFemme.\n\n" +
"Ton role unique : analyser un produit (huile essentielle, complement alimentaire, etc.)\n" +
"soumis dans le Banc d'essai, et rendre un avis scientifique prudent et source.\n\n" +
"Regles non negociables :\n" +
"1. Distingue toujours trois niveaux : ce que dit le fabricant (allegation), ce que dit\n" +
"   la science independante (preuve), ce que rapporte Severine (experience personnelle,\n" +
"   que tu ne dois jamais evaluer scientifiquement).\n" +
"2. N'utilise que des donnees verifiables (litterature scientifique, agences de sante,\n" +
"   pharmacopees reconnues). Si tu n'as pas de source fiable, dis-le explicitement au\n" +
"   lieu d'inventer une justification.\n" +
"3. Le champ Niveau de preuve doit etre un de : Non evalue, Faible, Modere, Solide,\n" +
"   Donnees insuffisantes.\n" +
"4. Le champ Securite / interactions doit toujours inclure une clause de prudence\n" +
"   quand elle est pertinente (grossesse, allaitement, pathologies, interactions\n" +
"   medicamenteuses, populations a risque).\n" +
"5. Une allegation fabricant ne devient jamais, par toi, une information de sante\n" +
"   validee : elle reste labellisee comme allegation tant qu'aucune preuve\n" +
"   independante ne la corrobore.\n" +
"6. Reponds uniquement en JSON valide, sans texte autour, avec exactement ces cles :\n" +
'   { "analyse_scientifique": string, "securite_interactions": string,\n' +
'     "niveau_preuve": string, "synthese_courte": string }';


module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee, utiliser POST." });
    return;
  }

  const providedKey = req.headers["x-solis-key"];
  if (!process.env.SOLIS_ACCESS_KEY || providedKey !== process.env.SOLIS_ACCESS_KEY) {
    res.status(401).json({ error: "Cle Solis manquante ou invalide." });
    return;
  }

  const body = req.body || {};
  const produit = body.produit;
  const marque = body.marque;
  const categorie = body.categorie;
  const composition = body.composition;
  const dose_fabricant = body.dose_fabricant;
  const allegations_fabricant = body.allegations_fabricant;
  const source_lien = body.source_lien;

  if (!produit) {
    res.status(400).json({ error: "Champ produit requis." });
    return;
  }
  const userPrompt = "Fiche a analyser :\n" +
    "- Produit : " + produit + "\n" +
    "- Marque : " + (marque || "non precisee") + "\n" +
    "- Categorie : " + (categorie || "non precisee") + "\n" +
    "- Composition / actifs : " + (composition || "non precisee") + "\n" +
    "- Dose fabricant : " + (dose_fabricant || "non precisee") + "\n" +
    "- Allegations fabricant : " + (allegations_fabricant || "aucune fournie") + "\n" +
    "- Source / lien fabricant : " + (source_lien || "aucun") + "\n\n" +
    "Rends ton analyse au format JSON demande.";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Erreur Claude API", detail: errText });
      return;
    }

    const data = await response.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = {
        analyse_scientifique: text,
        securite_interactions: "",
        niveau_preuve: "Non evalue",
        synthese_courte: "",
      };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Erreur interne Solis", detail: String(err) });
  }
};
};
