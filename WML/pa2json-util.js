'use strict';

function _pa2json(data) {
	//break data variable into an array then assign to "lines"
  var lines = data.trim().split('\r\n');
  
  //split the first thing in lines that has a tab in it then assign to "header"
  var header = lines[0].split('\t');
  //remove the "header" in "lines" since it's already been assigned to a var
  lines.splice(0, 1);
  
  return lines.map(function (line) {
    var dataPiece = {};
    line.split('\t').forEach(function (el, index) {
      dataPiece[header[index]] = el;
    });

    return dataPiece;
  });
}

module.exports = {
  translate: _pa2json
};