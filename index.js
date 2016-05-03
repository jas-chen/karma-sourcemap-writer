var fs = require('graceful-fs');
var path = require('path');

var sourcemapUrlRegeExp = /^\/\/#\s*sourceMappingURL=/;

var createSourceMapWriterPreprocessor = function(args, logger) {
  var log = logger.create('preprocessor.sourcemapWriter');
  var charsetRegex = /^;charset=([^;]+);/;

  return function(content, file, done) {
    function sourceMapData(data){
      var maps = JSON.parse(data);
      maps.sources = maps.sources.map(function(source) {
        return source.replace('webpack:///', '');
      });

      var filename = file.originalPath + '.map';
      log.debug('write source map into', filename);
      fs.writeFileSync(filename, JSON.stringify(maps));
      done(content);
    }

    function inlineMap(inlineData){
      var charset = 'utf-8';

      if (charsetRegex.test(inlineData)) {
        var matches = inlineData.match(charsetRegex);

        if (matches.length === 2) {
          charset = matches[1];
          inlineData = inlineData.slice(matches[0].length -1);
        }
      }

      if (/^;base64,/.test(inlineData)) {
        // base64-encoded JSON string
        log.debug('base64-encoded source map for', file.originalPath);
        var buffer = new Buffer(inlineData.slice(';base64,'.length), 'base64');
        sourceMapData(buffer.toString(charset));
      } else {
        // straight-up URL-encoded JSON string
        log.debug('raw inline source map for', file.originalPath);
        sourceMapData(decodeURIComponent(inlineData));
      }
    }

    var lines = content.split(/\n/);
    var lastLine = lines.pop();
    while (/^\s*$/.test(lastLine)) {
      lastLine = lines.pop();
    }

    var mapUrl;

    if (sourcemapUrlRegeExp.test(lastLine)) {
      mapUrl = lastLine.replace(sourcemapUrlRegeExp, '');
    }

    if (mapUrl && /^data:application\/json/.test(mapUrl)) {
      inlineMap(mapUrl.slice('data:application/json'.length));
    } else {
      log.debug('inline source map not found for', file.originalPath);
      done(content);
    }
  };
};

createSourceMapWriterPreprocessor.$inject = ['args', 'logger'];

// PUBLISH DI MODULE
module.exports = {
  'preprocessor:sourcemap-writer': ['factory', createSourceMapWriterPreprocessor]
};
