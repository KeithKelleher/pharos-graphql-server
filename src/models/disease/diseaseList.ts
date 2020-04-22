import {DataModelList} from "../DataModelList";
import {DiseaseFacetType} from "./diseaseFacetType";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetFactory} from "./diseaseFacetFactory";

export class DiseaseList extends DataModelList{
    constructor(json: any) {
        super("disease","name",new DiseaseFacetFactory(), json);
        this.facetsToFetch = FacetInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, this.DefaultFacets)));
    }
    AllFacets = Object.keys(DiseaseFacetType).filter(key => isNaN(Number(key)));
    DefaultFacets = this.AllFacets;

    addLinkToRootTable(query: any, db: any, facet: FacetInfo): void {
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', db.db.raw('t2tc.target_id'))
                .andWhere('disease.protein_id', db.db.raw('t2tc.protein_id'));
        }
    }

    addModelSpecificConstraints(query: any, db: any): void {
        if(this.term.length == 0){
            return;
        }
        query.andWhere(db.db.raw(`match(disease.name, disease.description, disease.drug_name) against('${this.term}' in boolean mode)`));
    }

    getRequiredTablesForFacet(info: FacetInfo): string[] {
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
        }

        return tableList;
    }
}
