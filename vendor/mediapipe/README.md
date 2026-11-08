# MediaPipe pose (local copy)

Camera rep counting loads these files from here first, so it works without outside servers (in the installed app, offline after the first use, and inside the Claude link). If they can't load, the app falls back to jsDelivr and unpkg.

- `vision_bundle.mjs` and `wasm/vision_wasm_internal.*`: `@mediapipe/tasks-vision` 0.10.14 from npm (Apache-2.0). Only the SIMD build is here; older phones without WebAssembly SIMD get the other build from the CDN.
- `pose_landmarker_lite.task`: Google's pose landmarker lite model (Apache-2.0), from storage.googleapis.com/mediapipe-models.

To update: `npm pack @mediapipe/tasks-vision@<version>`, copy the same files, download the model again, and change the version in `MP_SOURCES` in `index.html`.
