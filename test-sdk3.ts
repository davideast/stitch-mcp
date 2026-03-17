import { StitchSDK } from '@google/stitch-sdk';

const stitch = new StitchSDK({ apiKey: "123" });
console.log("project prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(stitch.project('test'))));
console.log("screen prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(stitch.project('test').getScreen('s'))));
