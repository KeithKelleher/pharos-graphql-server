import {FieldInfo} from "./FieldInfo";
import {DataModelList} from "./DataModelList";

export class ListManager {
    listMap: Map<string, FieldInfo[]> = new Map<string, FieldInfo[]>();

    addField(model: string, associatedModel: string, type: string, name: string, field: any) {
        const context = new ListContext(model, associatedModel, type, name);
        this.addToList(context, field);
        if (type === 'download' && name !== 'Single Value Fields') {
            const bucketContext = new ListContext(model, '', type, 'bucket');
            this.addToList(bucketContext, field);
        }
    }

    private addToList(context: ListContext, field: any) {
        let list: FieldInfo[] = [];
        if (this.listMap.has(context.toString())) {
            list = this.listMap.get(context.toString()) || [];
        } else {
            this.listMap.set(context.toString(), list);
        }
        list.push(new FieldInfo(field));
    }

    getDownloadLists(model: string, associatedModel: string, similarityQuery: boolean = false) {
        const lists: Map<string, FieldInfo[]> = new Map<string, FieldInfo[]>();
        this.listMap.forEach((fields, key) => {
            const listObj: ListContext = JSON.parse(key);

            if (listObj.model === model &&
                (listObj.associatedModel === associatedModel || listObj.associatedModel === '') &&
                listObj.type === ContextType.download &&
                listObj.listName !== 'bucket') {
                let list: FieldInfo[] = [];
                if (lists.has(listObj.listName)) {
                    list = lists.get(listObj.listName) || [];
                } else {
                    lists.set(listObj.listName, list);
                }
                list.push(...fields);
                if(listObj.listName === 'Single Value Fields' && similarityQuery){
                    list.push(...ListManager.similarityFields());
                }
            }
        });
        return lists;

    }

    getTheseFields(listObj: DataModelList, type: string, fields: string[], name: string = '') {
        const fieldList: FieldInfo[] = [];
        if (type === 'download') {
            fieldList.push(new FieldInfo({
                table: listObj.modelInfo.table,
                column: listObj.modelInfo.column,
                alias: 'id',
                parent: listObj
            } as FieldInfo));
        }
        fields.forEach(field => {
            const f = this.getOneField(listObj, type, field, '');
            if (f) {
                if (type === 'download') {
                    f.alias = field;
                }
                fieldList.push(f);
            }
        });
        return fieldList;
    }

    getTheseFilteringFields(listObj: DataModelList, type: string, fields: { facet: string, values: string[] }[]) {
        const context = this.getContext(listObj, type);
        const list = this.listMap.get(context.toString()) || [];
        const filteringFacets: FieldInfo[] = [];
        fields.forEach(ff => {
            const facet = list.find(field => field.name === ff.facet);
            if (facet) {
                facet.allowedValues = ff.values;
                filteringFacets.push(facet);
                facet.parent = listObj;
            }
        });
        return filteringFacets;
    }

    getDefaultFields(listObj: DataModelList, type: string, name: string = '') {
        let context = this.getContext(listObj, type, name);
        let list = this.listMap.get(context.toString()) || [];
        if (list.length === 0) {
            context = new ListContext(listObj.modelInfo.name, '', type, name);
            list = this.listMap.get(context.toString()) || [];
        }
        const fields = list.filter(field => field.order > 0).sort((a, b) => a.order - b.order);
        fields.forEach(f => f.parent = listObj);

        if (type === 'list' && listObj.similarity.match.length > 0) {
            fields.push(...ListManager.similarityFields(listObj));
        }

        return fields;
    }

    getAllFields(listObj: DataModelList, type: string, name: string = '') {
        const context = this.getContext(listObj, type, name);
        const fields = this.listMap.get(context.toString()) || [];
        fields.forEach(f => f.parent = listObj);
        return fields;
    }

    getOneField(listObj: DataModelList, type: string, fieldName: string, listName: string = '', includeSVF: boolean = true) {
        let f: FieldInfo | undefined = this.getOneFromContextList(listObj, type, fieldName, listName);
        if (f || !includeSVF) {
            return f;
        }
        if (type === 'download') {
            f = this.getOneFromBucketList(listObj, fieldName);
            if (f) {
                return f;
            }
        }
        return this.getOneFromSVFList(listObj, fieldName);
    }

    private getContext(listObj: DataModelList, type: string, name: string = '') {
        return new ListContext(listObj.modelInfo.name, listObj.getAssociatedModel(), type, name);
    }

    private getOneFromBucketList(listObj: DataModelList, fieldName: string) {
        const context = new ListContext(listObj.modelInfo.name, '', 'download', 'bucket');
        const list = this.listMap.get(context.toString()) || [];
        return this.findInList(list, fieldName, listObj);
    }

    private getOneFromContextList(listObj: DataModelList, type: string, fieldName: string, listName: string = '') {
        const context = this.getContext(listObj, type, listName);
        const list = this.listMap.get(context.toString()) || [];
        return this.findInList(list, fieldName, listObj);
    }

    private getOneFromSVFList(listObj: DataModelList, fieldName: string) {
        let context, list, f;
        if (listObj.getAssociatedModel()) {
            context = new ListContext(listObj.modelInfo.name, listObj.getAssociatedModel(), 'download', 'Single Value Fields');
            list = this.listMap.get(context.toString()) || [];
            f = this.findInList(list, fieldName, listObj);
            if (f) {
                return f;
            }
        }
        context = new ListContext(listObj.modelInfo.name, '', 'download', 'Single Value Fields');
        list = this.listMap.get(context.toString()) || [];
        f = this.findInList(list, fieldName, listObj);
        if (f) {
            return f;
        }
        if (listObj.similarity.match.length > 0) {
            f = this.findInList(ListManager.similarityFields(listObj), fieldName, listObj);
            if (f) {
                return f;
            }
        }
        return null;
    }

    private findInList(list: FieldInfo[], fieldName: string, listObj: DataModelList) {
        const f = list.find(field => field.name === fieldName);
        if (f) {
            f.parent = listObj;
        }
        return f;
    }

    static similarityFields(listObj?: DataModelList) : FieldInfo[]{
        const fields: FieldInfo[] = [];

        [   {description: 'Count of shared values between the base protein, and the test protein', name: 'Similarity: Common Count', column: 'overlap'},
            {description: 'Count of values for the base protein', name: 'Similarity: Base Count', column: 'baseSize'},
            {description: 'Count of values for the test protein', name: 'Similarity: Test Count', column: 'testSize'},
            {description: 'A pipe delimited list of common values between the two proteins', name: 'Similarity: Common Elements', column: 'commonOptions'},
            {description: 'Jaccard distance between the sets of values for the two proteins', name: 'Similarity: Jaccard Distance', column: 'jaccard'}].forEach(obj => {
            const f = new FieldInfo(
                {
                    isFromListQuery: true,
                    table: "filterQuery",
                    ...obj
                });
            if(listObj){
                f.parent = listObj;
            }
            fields.push(f);
        });
        return fields;
    }

}

export enum ContextType {
    facet,
    list,
    download,
    overlap
}

export class ListContext {
    model: string;
    associatedModel: string;
    type: ContextType;
    listName: string;

    constructor(model: string, associatedModel: string, type: string, name: string) {
        this.model = model;
        this.associatedModel = associatedModel || '';
        this.type = (<any>ContextType)[type];
        this.listName = name || '';
    }

    toString() {
        return JSON.stringify(this);
    }
}
