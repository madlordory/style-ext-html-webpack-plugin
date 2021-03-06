'use strict';

const CleanCss = require('clean-css');
const common = require('./common.js');
const debug = common.debug;
const error = common.error;
const denormaliseOptions = require('./config.js');
const findCssFile = require('./findFile.js');
const replaceLinkTagWithStyleTag = require('./replaceTag.js');
const insertStyleTagInHtml = require('./insertStyle.js');
const deleteFileFromCompilation = require('./removeFile.js');
const htmlWebpackPlugin = require("html-webpack-plugin");

// webpack 3.x and earlier
const events = {
    before: 'html-webpack-plugin-before-html-processing',
    alter: 'html-webpack-plugin-alter-asset-tags',
    after: 'html-webpack-plugin-after-html-processing'
};

// webpack 4.x and later
const hookEvents = {
    before: 'htmlWebpackPluginBeforeHtmlProcessing',
    alter: 'htmlWebpackPluginAlterAssetTags',
    after: 'htmlWebpackPluginAfterHtmlProcessing'
};

// map of html-webpack-hooks
const newHooksEvents = {
  htmlWebpackPluginBeforeHtmlProcessing: "beforeAssetTagGeneration",
  htmlWebpackPluginAlterAssetTags: "alterAssetTagGroups",
  htmlWebpackPluginAfterHtmlProcessing: "beforeEmit"
};

class StyleExtHtmlWebpackPlugin {
  constructor (options) {
    this.options = denormaliseOptions(options);
    this.filesToDelete = new Set();
    debug(`constructor: ${JSON.stringify(this.options)}}`);
  }

  apply (compiler) {
    const options = this.options;
    if (!options.enabled) return;

    const compile = this.compilationCallback.bind(this, options);
    const emit = this.emitCallback.bind(this);

    if (compiler.hooks) {
      compiler.hooks.compilation.tap('HtmlWebpackPlugin', compile.bind(this, hookEvents));
      compiler.hooks.emit.tapAsync('StyleExtHtmlWebpackPlugin', emit);
    } else {
      compiler.plugin('compilation', compile.bind(this, events));
      compiler.plugin('emit', emit);
    }
  }

  compilationCallback (options, events, compilation) {
    const minifier = (options.minify) ? new CleanCss(options.minify) : false;
    const wire = this.wirePluginEvent.bind(this);

    let cssFilename;

    wire(
      events.before,
      compilation,
      (pluginArgs) => {
        cssFilename = findCssFile(options, pluginArgs.plugin.options, compilation);
        if (cssFilename) {
          this.filesToDelete.add(cssFilename);
        }
      }
    );

    if (options.position === 'plugin') {
      wire(
        events.alter,
        compilation,
        (pluginArgs) => {
          if (cssFilename) {
            replaceLinkTagWithStyleTag(cssFilename, pluginArgs, compilation, minifier);
          }
        }
      );
    }

    if (options.position !== 'plugin') {
      wire(
        events.after,
        compilation,
        (pluginArgs) => {
          if (cssFilename) {
            insertStyleTagInHtml(cssFilename, options.position, pluginArgs, compilation, minifier);
          }
        }
      );
    }
  }

  // deals with webpack 4 changes:
  // < webpack 4.x - callbacks and plugin method
  // >= webpack 4.x - no callbacks and use tap method
  wirePluginEvent (event, compilation, fn) {
    const wrappedFn = (pluginArgs, callback) => {
      try {
        fn(pluginArgs);
        if (callback) {
          callback(null, pluginArgs);
        }
      } catch (err) {
        if (callback) {
          callback(err);
        } else {
          compilation.errors.push(err);
        }
      }
    };
    if (compilation.hooks) {
      debug('MikeE', event);
      debug('MikeE', compilation.hooks);

      (compilation.hooks[event] ||
          htmlWebpackPlugin.getHooks(compilation)[newHooksEvents[event]]
      ).tapAsync("StyleExtHtmlWebpackPlugin", wrappedFn);

    } else {
      compilation.plugin(event, wrappedFn);
    }
  }

  emitCallback (compilation, callback) {
    if (this.filesToDelete.size > 0) {
      const deleteFile = deleteFileFromCompilation.bind(null, compilation);
      this.filesToDelete.forEach(deleteFile);
      this.filesToDelete.clear();
    }
    if (callback) {
      callback();
    }
  }
  /**
   * Guard against pre v3 configurations
   */
  static inline (loaders) {
    error(`legacy configuration detected - please see https://github.com/numical/style-ext-html-webpack-plugin for how to configure v3.x+`);
  }
}

module.exports = StyleExtHtmlWebpackPlugin;
