import {TargetFacetFactory} from "./targetFacetFactory";
import {TargetFacetType} from "./targetFacetType";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {ConfigKeys} from "../config";

export class TargetList extends DataModelList {
    batch: string[] = [];
    skip: number = 0;
    top: number = 10;
    proteinList: string[] = [];
    proteinListCached: boolean = false;

    defaultSortParameters(): {column: string; order: string}[] {
        if(this.term){
            return [{column:'min_score', order:'asc'},{column:'name', order:'asc'}];
        }
        else if(this.associatedTarget){
            return [{column:'p_int', order:'desc'},{column:'score', order:'desc'}];
        }
        else if(this.associatedDisease){
            return [{column: 'dtype', order:'desc'}];
        }
        return [{column:'novelty', order:'desc'}];
    }

    constructor(tcrd: any, json: any) {
        super(tcrd,"protein", "id", new TargetFacetFactory(), json);
        if (json && json.batch) {
            this.batch = json.batch;
        }

        let facetList: string[];
        if (!json || !json.facets || json.facets.length == 0) {
            if(this.associatedTarget){
                facetList = this.DefaultPPIFacets;
            }
            else if(this.associatedDisease){
                facetList = this.DefaultDiseaseFacets;
            }
            else {
                facetList = this.DefaultFacets;
            }
        } else if (json.facets == "all") {
            facetList = this.AllFacets;
        } else {
            facetList = json.facets;
        }
        this.facetsToFetch = FacetInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList, this.isNull())));

        if (json) {
            this.skip = json.skip;
            this.top = json.top;
        }
    }

    listQueryKey() {
        if(this.associatedTarget){
            return ConfigKeys.Target_List_PPI;
        }
       if(this.associatedDisease){
            return ConfigKeys.Target_List_Disease;
        }
        return ConfigKeys.Target_List_Default;
    }

    addModelSpecificFiltering(query: any, list: boolean = false): void {
        if(list && this.term.length > 0) {
            query.join(this.tcrd.getScoredProteinList(this.term).as("searchQuery"), 'searchQuery.protein_id', 'protein.id');
        } else {
            if(!list || !this.associatedTarget) {
                this.addProteinListConstraint(query, this.fetchProteinList());
            }
        }
        this.addBatchConstraint(query, this.batch);
    }

    addLinkToRootTable(query: any, facet: FacetInfo): void {  // TODO, use database.ts instead, maybe we don't need this at all
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', this.database.raw('t2tc.target_id'))
                .andWhere('protein.id', this.database.raw('t2tc.protein_id'));
        } else if (facet.dataTable == 'ncats_idg_list_type') {
            query.andWhere('protein.id', this.database.raw('ncats_idg_list.protein_id'))
                .andWhere('ncats_idg_list_type.id', this.database.raw('ncats_idg_list.idg_list'));
        } else if (facet.type == "IMPC Phenotype") {
            query.andWhere('ortholog.geneid', this.database.raw('nhprotein.geneid'))
                .andWhere('ortholog.taxid', this.database.raw('nhprotein.taxid'))
                .andWhere('nhprotein.id', this.database.raw('phenotype.nhprotein_id'))
                .andWhere('protein.id', this.database.raw('ortholog.protein_id'));
        } else if (facet.dataTable === 'viral_protein' || facet.dataTable === 'virus') {
            query.andWhere('protein.id', this.database.raw('viral_ppi.protein_id'))
                .andWhere('viral_ppi.viral_protein_id', this.database.raw('viral_protein.id'))
                .andWhere('virus.virusTaxid', this.database.raw('viral_protein.virus_id'));
        }else if (facet.dataTable === 'panther_class') {
            query.andWhere('protein.id', this.database.raw('p2pc.protein_id'))
                .andWhere('p2pc.panther_class_id', this.database.raw('panther_class.id'));
        }else if (facet.dataTable === 'dto') {
            query.andWhere('protein.id', this.database.raw('p2dto.protein_id'))
                .andWhere('p2dto.dtoid', this.database.raw('dto.dtoid'));
        } else { // default is to use protein_id column from keyTable
            query.andWhere('protein.id', this.database.raw(facet.dataTable + '.protein_id'));
        }
    }

    getRequiredTablesForFacet(info: FacetInfo): string[] {  // TODO this too
        let tableList = [];
        tableList.push(this.rootTable);
        if (info.dataTable == this.rootTable) {
            return tableList;
        }
        tableList.push(info.dataTable);
        switch (info.dataTable) {
            case "target":
                tableList.push("t2tc");
                break;
            case "ncats_idg_list_type":
                tableList.push("ncats_idg_list");
                break;
            case "viral_protein":
            case "virus":
                tableList.push("viral_ppi");
                tableList.push("viral_protein");
                tableList.push("virus");
                break;
            case "panther_class":
                tableList.push("p2pc");
                break;
            case "dto":
                tableList.push("p2dto");
                break;
        }
        if (info.type == "IMPC Phenotype") {
            tableList.push("nhprotein");
            tableList.push("ortholog");
        }
        return tableList;
    }

    fetchProteinList(): any {
        if (this.term.length == 0 && this.associatedTarget.length == 0 && this.associatedDisease.length == 0) {
            return null;
        }
        if (this.proteinListCached) {
            return this.proteinList;
        }
        let proteinListQuery;
        if (this.term) {
            proteinListQuery = this.tcrd.getProteinList(this.term);
        } else if (this.associatedTarget) {
            proteinListQuery = this.tcrd.getProteinListFromPPI(this.associatedTarget, this.ppiConfidence);
        }
        else{
            proteinListQuery = this.database.select(this.database.raw(` 
distinct protein_id
FROM
    disease as d
JOIN (SELECT "${this.associatedDisease}" AS name UNION SELECT 
            lst.name
        FROM
            ncats_do lst,
            (SELECT 
                MIN(lft) AS 'lft', MIN(rght) AS 'rght'
            FROM
                ncats_do
            WHERE
                name = "${this.associatedDisease}") AS finder
        WHERE
            finder.lft + 1 <= lst.lft
                AND finder.rght >= lst.rght) as diseaseList
ON diseaseList.name = d.ncats_name`));
        }
        this.captureQueryPerformance(proteinListQuery, "protein list");
        return proteinListQuery;
    }

    cacheProteinList(list: string[]) {
        this.proteinListCached = true;
        this.proteinList = list;
    }

    addBatchConstraint(query: any, batch: string[]) {
        if (!!batch && batch.length > 0) {
            query.andWhere
            (function (builder: any) {
                builder.whereIn('protein.uniprot', batch)
                    .orWhereIn('protein.sym', batch)
                    .orWhereIn('protein.stringid', batch)
            });
        }
    };

    addProteinListConstraint(query: any, proteinList: any) {
        if (!!proteinList) {
            query.whereIn('protein.id', proteinList);
        }
    };

    isNull() {
        if (this.batch.length > 0) {
            return false;
        }
        if (this.term.length > 0) {
            return false;
        }
        if(this.associatedTarget.length > 0) {
            return false;
        }
        if(this.associatedDisease.length > 0){
            return false;
        }
        if (this.filteringFacets.length > 0) {
            return false;
        }
        return true;
    }

    static AllFacets(){
        return Object.keys(TargetFacetType).filter(key => isNaN(Number(key)));
    }

    AllFacets = TargetList.AllFacets();

    assocationFacets = [
        "Target Development Level",
        'Family',
        "IDG Target Lists",
        "Reactome Pathway",
        "GO Process",
        "GO Component",
        "GO Function",
        "UniProt Disease",
        "Expression: UniProt Tissue",
        "Ortholog"];

    DefaultPPIFacets = [
        "StringDB Interaction Score",
        "BioPlex Interaction Probability",
        "PPI Data Source",
        ...this.assocationFacets];

    DefaultDiseaseFacets = [
        "JensenLab Confidence",
        "Expression Atlas Log2 Fold Change",
        "DisGeNET Score",
        "Disease Data Source",
        "Linked Disease",
        ...this.assocationFacets];

    DefaultFacets = [
        'DTO Class',
        'Target Development Level',
        'IDG Target Lists',
        'Data Source',
        'Log Novelty',
        'Log PubMed Score',
        'Family',
        'PANTHER Class',
        'Interacting Virus',
        'Interacting Viral Protein (Virus)',
        "JAX/MGI Phenotype",
        'GWAS',
        'UniProt Disease'
    ];
}
