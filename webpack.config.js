"use strict"

var path = require("path")
var dotenv = require("dotenv")
var webpack = require("webpack")

dotenv.load({silent: true})

module.exports = {
  entry: [
    "bootstrap-webpack!./bootstrap.config.js",
    path.join(__dirname, "public", "app.js")
  ],
  output: {
    path: path.join(__dirname, "public"),
    filename: "bundle.js"
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": {
        "SOCKETIO_HOST": JSON.stringify(process.env.SOCKETIO_HOST)
      }
    })
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bootstrap.config.js)/,
        loader: "babel"
      },
      {test: /\.css$/, loader: "style!css"},
      {
        test: /\.(ttf|eot|svg|png|jpg|woff(2)?)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: "url"
      }
    ]
  }
}
