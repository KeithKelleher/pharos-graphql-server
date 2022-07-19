export class HierarchicalQuery {
    knex: any;

    constructor(knex: any) {
        this.knex = knex;
    }

    getExpressionTableData(table: string, select: any, protein_id: number) {
        const query = this.knex(
            {
                [table]: table,
                uberon_ancestry: 'uberon_ancestry',
                direct: 'uberon',
                ancestor: 'uberon',
                direct_parent: 'uberon_parent',
                ancestor_parent: 'uberon_parent'
            }
        ).select(select)
            .select({
                uberon_id: table + '.uberon_id',
                direct_name: 'direct.name',
                direct_parent: 'direct_parent.parent_id',
                ancestor_uberon_id: 'ancestor_uberon_id',
                ancestor_name: 'ancestor.name',
                ancestor_parent: 'ancestor_parent.parent_id'
            })
            .where(table + '.uberon_id', this.knex.raw('uberon_ancestry.uberon_id'))
            .where('protein_id', protein_id)
            .where('direct.uid', this.knex.raw(table + '.uberon_id'))
            .where('ancestor.uid', this.knex.raw('uberon_ancestry.ancestor_uberon_id'))
            .where('direct_parent.uid', this.knex.raw(table + '.uberon_id'))
            .where('ancestor_parent.uid', this.knex.raw('uberon_ancestry.ancestor_uberon_id'))
            .whereNotIn('uberon_ancestry.ancestor_uberon_id', ['GO:0005623']);
        return query;
    }

    getExpressionHierarchy(protein_id: number) {
        return this.getExpressionTableData('gtex', {
            id: this.knex.raw(`concat('gtex-',gtex.id)`),
            etype: this.knex.raw('"GTEx"'),
            tissue: 'tissue',
            value: 'tpm_rank'
        }, protein_id)
            .union(this.getExpressionTableData('expression', {
                id: this.knex.raw(`concat('expression-',expression.id)`),
                etype: 'etype',
                tissue: 'tissue',
                value: this.knex.raw('coalesce(source_rank, number_value / 5)'),
            }, protein_id)).then((res: any[]) => {
                const uberonDict = new Map<string, any>();
                const parentDict = new Map<string, string[]>();
                const expressionDict = new Map<string, any>();
                res.forEach(row => {
                    if (row.value > 0) {
                        this.tryAddSingleElement(expressionDict, row.id, {
                            etype: row.etype,
                            value: row.value,
                            uberon_id: row.uberon_id,
                            tissue: row.direct_name
                        });
                        const dictElement = this.tryAddSingleElement(uberonDict, row.uberon_id, {
                            uid: row.uberon_id,
                            name: row.direct_name,
                            data: new Map<string, number>(),
                            parents: [],
                            children: []
                        });
                        this.tryAddSingleElement(dictElement.data, row.id, row.value);
                        this.tryAddSingleElement(uberonDict, row.ancestor_uberon_id, {
                            uid: row.ancestor_uberon_id,
                            name: row.ancestor_name,
                            data: new Map<string, number>(),
                            parents: [],
                            children: []
                        });
                        this.tryAddListElement(parentDict, row.uberon_id, row.direct_parent);
                        this.tryAddListElement(parentDict, row.ancestor_uberon_id, row.ancestor_parent);
                    }
                });
                const nonRoots: string[] = [];
                uberonDict.forEach((v, k) => {
                    const parents = parentDict.get(k) || [];
                    v.parents = parents;
                    parents.forEach(uid => {
                        const oneParent = uberonDict.get(uid);
                        if (oneParent) {
                            if (!nonRoots.includes(k)) {
                                nonRoots.push(k);
                            }
                            oneParent.children.push(v);
                        }
                    });
                });
                nonRoots.forEach(nonRoot => {
                    uberonDict.delete(nonRoot);
                });
                uberonDict.forEach((v, k) => {
                    this.calcData(v);
                });
                this.collapseDictionary(uberonDict)
                return {
                    uberonDict: Array.from(uberonDict.values())
                };
            });
    }

    tryAddSingleElement(dict: Map<string, any>, key: string, value: any) {
        if (!dict.has(key)) {
            dict.set(key, value);
        }
        return dict.get(key);
    }

    tryAddListElement(dict: Map<string, any[]>, key: string, value: any) {
        let list: any[] = dict.get(key) || [];
        if (list.length === 0) {
            dict.set(key, list);
        }
        if (!list.includes(value)) {
            list.push(value);
        }
    }

    calcData(node: any) {
        node.children.forEach((child: any) => {
            this.calcData(child);
        });
        if ((node.data && node.data.size > 0) && node.children.length > 0 ) {
            const directNode = {
                uid: node.uid,
                name: node.name + ' (direct)',
                data: new Map<string, number>(),
                parents: [],
                children: [],
                direct: 1,
                // @ts-ignore
                value: Math.max(...Array.from(node.data.values()))
            };
            node.children.push(directNode);
        }
        const list: number[] = node.children.map((c: any) => c.value);
        if (node.data && node.data.size > 0) {
            // @ts-ignore
            list.push(...Array.from(node.data.values()));
        }
        node.value = Math.max(...list);
    }

    tryPushValue(map: Map<number, number>, id: number, val: number) {
        if (map.has(id)) {
            return;
        }
        map.set(id, val);
    }

    trimNode(node: any) {
        let found = true;
        while (found) {
            found = false;

            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i];
                if (child.children.length === 0 && child.value == 0) {
                    node.children.splice(i, 1);
                    found = true;
                } else {
                    this.trimNode(child);
                    if (child.data.size === 0 && child.children.length === 1) {
                        node.children[i] = child.children[0];
                        this.trimNode(node.children[i]);
                        found = true;
                    }
                }
            }
        }
        let nondups: string[] = []
        for (let i = node.children.length - 1; i >= 0; i--) {
            const key = node.children[i].name + '-' + node.children[i].uid;
            if (nondups.includes(key)) {
                node.children.splice(i, 1);
                found = true;
            } else {
                nondups.push(key);
            }
        }
    }

    collapseDictionary(dict: Map<string, any>) {
        dict.forEach((v, k) => {
            this.trimNode(v);
        })
    }
}
