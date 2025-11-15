module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ios.js', '.android.js', '.ts', '.tsx', '.js', '.json'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
