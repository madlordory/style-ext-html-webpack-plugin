'use strict';

const common = require('./common.js');

const debug = common.debug;
const error = common.error;

const CSS_REGEX = /\.css$/;
const NO_FILES = {};

const validateCssFile = cssFilename => filename => filename === cssFilename;

const identifyCssFile = cssRegex => filename => (cssRegex || CSS_REGEX).test(filename);

const allFiles = () => true;

const onlyChunkFiles = (chunkNames, htmlWebpackPluginChunks, compilation) => {
  // cannot use Array.prototype.includes < node v6
  let matchingChunks = [];//compilation.chunks.filter(chunk => chunkNames.indexOf(chunk.name) > -1);
  chunkNames&&chunkNames.forEach(chunkName=>{
    const entrypoint=compilation.entrypoints.get(chunkName);
    if (entrypoint) {
      const chunks=entrypoint.chunks;
      chunks&&matchingChunks.push(...chunks);
    }
  });
  if (htmlWebpackPluginChunks) {
    const htmlWebpackPluginMatchingChunks =[];// matchingChunks.filter(chunk => htmlWebpackPluginChunks.indexOf(chunk.name) > -1);
    htmlWebpackPluginChunks&&htmlWebpackPluginChunks.forEach(chunkName=>{
      const chunks=compilation.entrypoints.get(chunkName).chunks;
      chunks&&htmlWebpackPluginMatchingChunks.push(...chunks);
    });
    matchingChunks=matchingChunks.filter(chunk => htmlWebpackPluginMatchingChunks.indexOf(chunk) > -1);
  }
  return matchingChunks.length > 0
    ? filename => matchingChunks.some(chunk => chunk.files.indexOf(filename) > -1)
    : NO_FILES;
};

const findGeneratedCssFile = (fileMatcher, fileFilter, compilation) => {
  const filenames = Object.keys(compilation.assets).filter(fileFilter);
  for (let filename of filenames) {
    if (fileMatcher(filename)) {
      debug(`CSS file in compilation: '${filename}'`);
      return filename;
    }
  }
  return null; // project without css will cause an error, return null will be friendly
  // error(`could not find ExtractTextWebpackPlugin's generated .css file; available files: '${filenames.join()}'`);
};

const findCssFile = (options, htmlWebpackPluginOptions, compilation) => {
  const fileMatcher = (options.cssFilename)
    ? validateCssFile(options.cssFilename)
    : identifyCssFile(options.cssRegExp);
  const fileFilter = (options.chunks)
    ? onlyChunkFiles(options.chunks, htmlWebpackPluginOptions.chunks, compilation)
    : allFiles;
  if (fileFilter === NO_FILES) {
    return null;
  } else {
    return findGeneratedCssFile(fileMatcher, fileFilter, compilation);
  }
};

module.exports = findCssFile;
