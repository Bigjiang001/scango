import { copyFileSync } from "node:fs";
copyFileSync(
  new URL(
    "../node_modules/@techstark/opencv-js/dist/opencv.js",
    import.meta.url,
  ),
  new URL("../public/opencv.js", import.meta.url),
);
console.log(
  "Copied the installed OpenCV.js into the offline application assets.",
);
