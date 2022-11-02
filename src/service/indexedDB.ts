import Dexie from "dexie";
import {getMockValue} from "./mock";
import randomWords from 'random-words';

class ArticlesDb extends Dexie {
    articles!: Dexie.Table<IArticle, number>;
    words!: Dexie.Table<IWords, number>;
    tokens!: Dexie.Table<ITokens, number>;

    constructor() {
        super("articles");
        this.version(1).stores({
            articles: 'id, title, desc, filters',
            words: 'id, words',
            tokens: 'id, *words'
        });
    }
}

interface IWords {
    id: number,
    words: string
}

interface ITokens {
    id: number,
    words: string[]
}

interface IArticle {
    id?: number,
    value?: any,
    title: string,
    desc: string,
    words?: string[]
    filters?: string[]
}

export const db = new ArticlesDb();


db.articles.hook("creating", function (primKey, obj, trans) {
    db.words.add({id: obj.id, words: ' ' + getAllWords(obj.title + ' ' + obj.desc).join(' ') + ' '})
    db.tokens.add({id: obj.id, words: getAllWords(obj.title + ' ' + obj.desc)})
    console.log(obj.id)
    //obj.words = getAllWords(obj.title + ' ' + obj.desc)
});
db.articles.hook("updating", function (mods, primKey, obj, trans) {
    db.words.update(obj.id, {words: ' ' + getAllWords(obj.title + ' ' + obj.desc).join(' ')})
    db.tokens.add({id: obj.id, words: getAllWords(obj.title + ' ' + obj.desc)})
    //return { words: getAllWords(obj.title + ' ' + obj.desc) };
});

const getAllWords = (text: string): string[] => {
    const words = new Set(text.split(' '));
    return Array.from(words).map(v => v.toLowerCase());
}
db.open();

export const fillDb = async () => {
    return db.transaction('rw', db.articles, db.tokens, db.words, function () {
        debugger
        for (let i = 1; i < 100_000; i++) {
            console.log(i)
            const title = `title title${i} title${i % 10} title${i % 100} title${i % 1000}`;
            const desc = `desc ${randomWords({min: 5, max: 30}).join(' ')}`;
            db.articles.add({
                id: i,
                title,
                desc,
                filters: [`filter${i % 10}`, `filter${i % 100}`],
                value: getMockValue()
            })
        }
        db.articles.bulkAdd([{
            id: 111111,
            title: 'Nissan almera',
            desc: 'passenger machine',
            filters: ['filter1', 'filter3']
        },
            {
                id: 222222,
                title: 'car',
                desc: 'Car2',
                filters: ['filter1', 'filter3']
            },
            {
                id: 333333,
                title: 'Carrera gt s',
                desc: 'super',
                filters: ['filter2', 'filter4']
            }
        ])
    })
}


export async function startsWithSearch(prefixes: string[], filters?: string[], count = 100) {
    return db.transaction('r', db.articles, db.tokens, function* () {
        const hasFilters = !!filters;
        const promises = [
            ...prefixes.map(prefix =>
                db.tokens
                    .where('words')
                    .equals(prefix)
                    .primaryKeys()),
            ...prefixes.map(prefix =>
                db.tokens
                    .where('words')
                    .startsWith(prefix)
                    .primaryKeys())
        ]
        if (hasFilters) {
            promises.push(getFilteredIds(filters))
        }
        const results = yield Dexie.Promise.all(promises)
        const idsWithWeight: { [key: string]: number } = {};
        const weightsWithIds: { [key: string]: string } = {}
        let fullMatchIds: number[] = results.splice(0, prefixes.length).flat()
        let partialMatchIds: number[] = results.splice(0, prefixes.length).flat()
        if (hasFilters) {
            const filteredIds: Set<number> = new Set(results[0]);
            fullMatchIds = fullMatchIds.filter(id => filteredIds.has(id))
            partialMatchIds = partialMatchIds.filter(id => filteredIds.has(id))
        }
        fullMatchIds.forEach(id => idsWithWeight[id] = (idsWithWeight[id] ?? 0) + 10)
        partialMatchIds.forEach(id => idsWithWeight[id] = (idsWithWeight[id] ?? 0) + 1)
        Object.entries(idsWithWeight).forEach(([key, value]) => {
            weightsWithIds[value] = weightsWithIds[value] + ',' + key;
        })
        const strIds = Object.keys(weightsWithIds).reverse().reduce((ids, w) => ids + ',' + weightsWithIds[w], '')
        const ids = strIds.split(',').map(v => +v).filter(id => id).slice(0, count);
        const result = yield db.articles.where('id').anyOf(ids).toArray()
        const mappedResult = new Map(result.map(v => [v.id, v]))
        return ids.map(id => mappedResult.get(id))
    })
}

export const indexOfSearch = async (prefixes: string[], filters?: string[], count = 100) => {
    const idsWithWeight: { [key: string]: number } = {};
    const weightsWithIds: { [key: string]: string } = {};
    const filteredIds = filters ? new Set(await getFilteredIds(filters)) : null;
    await db.words.each(value => {
        prefixes.forEach(prefix => {
            if (filteredIds && !filteredIds.has(value.id)) {
                return
            }
            if (value.words.indexOf(' ' + prefix + ' ') >= 0) {
                idsWithWeight[value.id] = (idsWithWeight[value.id] ?? 0) + 10
            }
            if (value.words.indexOf(prefix) >= 0) {
                idsWithWeight[value.id] = (idsWithWeight[value.id] ?? 0) + 1
            }
        })
    })
    Object.entries(idsWithWeight).forEach(([key, value]) => {
        weightsWithIds[value] = weightsWithIds[value] + ',' + key;
    })
    const strIds = Object.keys(weightsWithIds).reverse().reduce((ids, w) => ids + ',' + weightsWithIds[w], '')
    const ids = strIds.split(',').map(v => +v).filter(id => id).slice(0, count);
    const result = await db.articles.where('id').anyOf(ids).toArray()
    const mappedResult = new Map(result.map(v => [v.id, v]))
    return ids.map(id => mappedResult.get(id))
}

export const getFilteredIds = (filters: string[] = []) => {
    const lower: any[] = [];
    const upper: any[] = []
    filters.map(filter => {
        if (filter) {
            lower.push(filter);
            upper.push(filter)
        } else {
            lower.push(Dexie.minKey);
            upper.push(Dexie.maxKey)
        }
    });
    return db.articles.where('filters').between(lower, upper, true, true).primaryKeys()
}


export const each = () => {
    return db.words.each((article, i) => {
    })
}