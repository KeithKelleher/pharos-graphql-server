export enum TargetFacetType {
    "Target Development Level",
    "IDG Target Lists",
    "UniProt Keyword",
    "Family",
    "Indication",
    "Monarch Disease",
    "UniProt Disease",
    "Ortholog",
    "IMPC Phenotype",
    "JAX/MGI Phenotype",
    "GO Process",
    "GO Component",
    "GO Function",
    "GWAS",
    // "Expression: CCLE", // these three are not too informative, because all options have the same set of targets
    // "Expression: HCA RNA", // and they're super slow
    // "Expression: HPM Protein", // so let's just not calculate them
    "Expression: HPA",
    "Expression: JensenLab Experiment HPA",
    "Expression: HPM Gene",
    "Expression: JensenLab Experiment HPA-RNA",
    "Expression: JensenLab Experiment GNF",
    "Expression: Consensus",
    "Expression: JensenLab Experiment Exon array",
    "Expression: JensenLab Experiment RNA-seq",
    "Expression: JensenLab Experiment UniGene",
    "Expression: UniProt Tissue",
    "Expression: JensenLab Knowledge UniProtKB-RC",
    "Expression: JensenLab Text Mining",
    "Expression: JensenLab Experiment Cardiac proteome",
    "Expression: Cell Surface Protein Atlas",
    "Reactome Pathway",
    "WikiPathways Pathway",
    "KEGG Pathway",
    "PPI Data Source",
    "Disease Data Source",
    "Linked Disease",
    "Interacting Viral Protein (Virus)",
    "Interacting Virus",
    "Log Novelty",
    "Log PubMed Score",
    "StringDB Interaction Score",
    "BioPlex Interaction Probability",
    "JensenLab TextMining zscore",
    "JensenLab Confidence",
    "Expression Atlas Log2 Fold Change",
    "DisGeNET Score"
}
