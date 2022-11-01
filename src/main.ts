import {createApp} from 'vue'
import App from './App.vue'
import './index.css'

const app = createApp(App)
app.mount('#app')

import {db, addData, filter, find, each} from "./service/indexedDB";

//await addData()

console.log('memory: ' + window.performance.memory.usedJSHeapSize / 10048576 + 'mb')

const filterTimes: number[] = [];
const findTimes: number[] = [];

// prefixes and filters in lowercase
const test = async (name: string, words: string[], filters?: string[]) => {
    let start = window.performance.now();
    let res = await filter(words, filters);
    let end = window.performance.now();
    let time = end - start;
    console.log(`%c${name}: filter, time: ${time.toFixed(0)}ms, count: ${res.length}`, 'background: red; color:white')
    filterTimes.push(time);

    start = window.performance.now();
    res = await find(words, filters);
    end = window.performance.now();
    time = end - start;
    console.log(`%c${name}: find, time: ${time.toFixed(0)}ms, count: ${res.length}`, 'background: blue; color:white')
    findTimes.push(time);
}

await test('test1', ['car', 'gt', 's']);
await test('test2', ['title']);
await test('test3', ['title'], ['filter1', 'filter1']);
await test('test4', ['title9901']);
await test('test5', ['title9901'], ['filter1', 'filter1']);
await test('test6', ['title', 't', 'd']);
await test('test7', ['title', 't', 'd'], ['filter1', '']);

console.log(`%c average filter: ${(filterTimes.reduce((s, v) => s + v, 0) / filterTimes.length).toFixed(0)}ms`, 'background: red; color:white')
console.log(`%c average find: ${(findTimes.reduce((s, v) => s + v, 0) / findTimes.length).toFixed(0)}ms`, 'background: blue; color:white')


console.time('s')
//const res = await filter(['title']);
//const res = await filter(['title9901'],['filter1','filter1']);
// await filter2()
//console.table(res);
console.timeEnd('s')


//console.table(res)
//const s = await db.articles.toArray();
// console.log('count:'+s.length)
// console.log( 'dbSize:' + new Blob(s).size/1048576 + 'mb' );
// console.log('memory: '+window.performance.memory.usedJSHeapSize/1048576+'mb')

