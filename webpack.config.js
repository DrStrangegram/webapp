const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => {
  const mode = argv.mode === 'production' ? 'prod' : 'dev';
  return {
    entry: {
      index: path.resolve(__dirname, 'src/index.js'),
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          loaders: [
            'babel-loader',
          ],
          exclude: /node_modules/,
        }, {
          test: /\.css$/,
          use: [
            'style-loader',
            { loader: 'css-loader', options: { importLoaders: 1, url: false } },
            'postcss-loader'
          ]
        }
      ],
    },
    output: {
      path: path.resolve(__dirname, 'umd'),
      filename: `[name].js`,
      publicPath: '/umd/'
    },
    devServer: {
      compress: true,
      port: 9000,
    },
    optimization: {
      minimizer: [
        // we specify a custom UglifyJsPlugin here to get source maps in production.
        new UglifyJsPlugin({
          cache: true,
          parallel: true,
          uglifyOptions: {
            compress: true,
            mangle: true
          },
          sourceMap: true
        })
      ]
    },
    performance: {
      maxEntrypointSize: 262144,
      maxAssetSize: 262144
    },
    plugins: [
      new CopyPlugin([
        { from: `node_modules/tinode-sdk/umd/tinode.${mode}.js`, to: `tinode.js` },
      ]),
    ],
  };
}
