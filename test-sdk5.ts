import * as stitchSdk from '@google/stitch-sdk';

const stitch = stitchSdk.stitch;
console.log("stitch keys:", Object.keys(stitch));
console.log("StitchToolClient:", !!stitchSdk.StitchToolClient);
console.log("StitchProxy:", !!stitchSdk.StitchProxy);
