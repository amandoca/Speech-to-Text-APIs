// webpack.config.js
const path = require("path");
const webpack = require("webpack");
require("dotenv").config(); // Carrega o arquivo .env

module.exports = {
  entry: "./src/app.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    fallback: {
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser",
    }),
    new webpack.DefinePlugin({
      "process.env.AWS_REGION": JSON.stringify(process.env.AWS_REGION),
      "process.env.AWS_ACCESS_KEY_ID": JSON.stringify(process.env.AWS_ACCESS_KEY_ID),
      "process.env.AWS_SECRET_ACCESS_KEY": JSON.stringify(process.env.AWS_SECRET_ACCESS_KEY),
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    port: 3000,
  },
  mode: "development",
};
