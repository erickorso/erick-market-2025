module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 moved its transform into react-native-worklets, and it has
    // to be the last plugin in the list — it rewrites function bodies, so
    // anything running after it would be transforming code it never saw.
    plugins: ["react-native-worklets/plugin"],
  };
};
