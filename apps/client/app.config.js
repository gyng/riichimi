const { expo } = require("./app.json");

// GitHub Pages serves this repo under /riichimi/, so the export needs a base
// path. It is set through the environment rather than app.json so a local build
// keeps root-relative paths and `npm run serve:web` and the browser dogfood
// continue to work unchanged.
module.exports = () => {
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  if (baseUrl === undefined || baseUrl === "") {
    return expo;
  }
  return { ...expo, experiments: { ...expo.experiments, baseUrl } };
};
