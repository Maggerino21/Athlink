module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already injects react-native-worklets/plugin when the
    // package is present (it is, via Reanimated 4). Adding it manually here as
    // well applied it twice — don't reintroduce it.
    presets: ['babel-preset-expo'],
  };
};
