// Loose ambient declaration for the vendored/UMD Three.js global, so the Vite
// TypeScript build does not require @types/three. In the offline standalone the
// `import * as THREE from 'three'` line is stripped and THREE resolves to the
// vendored UMD global instead.
declare module 'three';
declare const THREE: any;
