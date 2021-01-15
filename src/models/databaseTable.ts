import {DataModelList} from "./DataModelList";

export class DatabaseTable {
    tableName: string;
    primaryKey?: string;
    links: TableLink[] = [];
    dataTypes: Map<string, string> = new Map<string, string>();
    isSparse: boolean;
    isTypeTable: boolean;

    constructor(database: any, dbname: string, name: string) {
        this.tableName = name;
        this.isSparse = DatabaseTable.sparseTables.includes(name);
        this.isTypeTable = DatabaseTable.typeTables.includes(name);
        this.getKeys(database, dbname);
        this.getColumnInfo(database, dbname);
    }

    getColumnInfo(database: any, dbname: string) {
        let query = database('INFORMATION_SCHEMA.COLUMNS')
            .select(['column_name', 'data_type'])
            .where('table_schema', dbname)
            .andWhere('table_name', this.tableName);
        query.then((rows: any) => {
            for (let rowKey in rows) {
                this.dataTypes.set(rows[rowKey]['column_name'], rows[rowKey]['data_type']);
            }
        });
    }

    columnIsNumeric(column: string) {
        let dataType = this.dataTypes.get(column)?.toLowerCase();
        if (dataType) {
            return ['bigint', 'int', 'tinyint', 'decimal', 'double', 'float'].includes(dataType);
        }
        return null
    }

    getKeys(database: any, dbname: string) {
        let query = database('information_schema.key_column_usage')
            .select(['constraint_name', 'column_name', 'referenced_table_name', 'referenced_column_name'])
            .where('table_schema', dbname)
            .andWhere('table_name', this.tableName);
        query.then((rows: any) => {
            for (let rowKey in rows) {
                if (rows[rowKey]['constraint_name'] == 'PRIMARY') {
                    this.primaryKey = rows[rowKey]['column_name']
                } else {
                    this.links.push(new TableLink(
                        rows[rowKey]['column_name'],
                        rows[rowKey]['referenced_table_name'],
                        rows[rowKey]['referenced_column_name']));
                }
            }
        });
    }

    // Ideally, this config should be fetched from db too, for now it's here
    /**
     * tables which should always be left joined to because they might not have a mapping
     */
    static sparseTables: string[] = ["tinx_novelty"];

    /**
     * tables which have a data type column which describes the data the caller wants
     * These should be left joined to columns matching caller's datatype
     */
    static typeTables: string[] = ["tdl_info"];
    static typeTableColumns: Map<string, string> = new Map(
        [
            ["tdl_info", "itype"]
        ]
    );

    static preferredLink: Map<string, string> = new Map(
        [
            ["ncats_ppi-protein", "protein_id"]
        ]
    );

    static additionalWhereClause(table: string, alias: string, dataModelListObj: DataModelList) {
        if (table == "ncats_ppi") {
            return `${alias}.other_id = (select id from protein where match(uniprot,sym,stringid) against('${dataModelListObj.associatedTarget}' in boolean mode))
            and NOT (${alias}.ppitypes = 'STRINGDB' AND ${alias}.score < ${dataModelListObj.ppiConfidence})`;
        }
        return null;
    }

    static typeTableColumnMapping: Map<string, string> = new Map(
        [
            ["tdl_info-Ab Count", "integer_value"],
            ["tdl_info-MAb Count", "integer_value"],
            ["tdl_info-NCBI Gene PubMed Count", "integer_value"],
            ["tdl_info-EBI Total Patent Count", "integer_value"],
            ["tdl_info-ChEMBL First Reference Year", "integer_value"],

            ["tdl_info-JensenLab PubMed Score", "number_value"],
            ["tdl_info-PubTator Score", "number_value"],
            ["tdl_info-HPM Protein Tissue Specificity Index", "number_value"],
            ["tdl_info-HPM Gene Tissue Specificity Index", "number_value"],
            ["tdl_info-HPA Tissue Specificity Index", "number_value"],

            ["tdl_info-IMPC Clones", "string_value"],
            ["tdl_info-TMHMM Prediction", "string_value"],
            ["tdl_info-UniProt Function", "string_value"],
            ["tdl_info-ChEMBL Selective Compound", "string_value"],
            ["tdl_info-Experimental MF/BP Leaf Term GOA", "string_value"],
            ["tdl_info-Antibodypedia.com URL", "string_value"],
            ["tdl_info-IMPC Status", "string_value"],
            ["tdl_info-NCBI Gene Summary", "string_value"],

            ["tdl_info-Is Transcription Factor", "boolean_value"]
        ]
    );

    static leftJoinTables: string[] = DatabaseTable.sparseTables.concat(DatabaseTable.typeTables);

    static requiredLinks: Map<string, string[]> = new Map(
        [
            ["protein-target", ["t2tc"]],
            ["protein-viral_protein", ["viral_ppi", "virus"]],
            ["protein-virus", ["viral_ppi", "viral_protein"]],
            ["protein-dto", ["p2dto"]],
            ["protein-panther_class", ["p2pc"]],
            ["protein-virus", ["viral_protein", "viral_ppi"]],
            ["protein-viral_protein", ["virus", "viral_ppi"]],
            ["protein-ncats_ligands", ["ncats_ligand_activity", "target", "t2tc"]]
        ]);

    static getRequiredLinks(table1: string, table2: string): string[] | undefined {
        const reqTables = DatabaseTable.requiredLinks.get(table1 + "-" + table2);
        if (reqTables) return reqTables;
        return DatabaseTable.requiredLinks.get(table2 + "-" + table1);
    }
}

export class TableLink {
    column: string;
    otherTable: string;
    otherColumn: string;

    constructor(column: string, otherTable: string, otherColumn: string) {
        this.column = column;
        this.otherTable = otherTable;
        this.otherColumn = otherColumn;
    }
}

export class TableLinkInfo {
    fromCol: string;
    toCol: string;

    constructor(fromColumn: string, toColumn: string) {
        this.fromCol = fromColumn;
        this.toCol = toColumn;
    }
}