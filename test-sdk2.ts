import { stitch } from '@google/stitch-sdk';

console.log("stitch keys:", Object.keys(stitch));
console.log("project prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(stitch.project('test'))));
