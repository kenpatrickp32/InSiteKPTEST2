//This function will be the one responsible for converting the ILI file (.csv) 
//to a JSON format
'use strict';

function _csv2json(data) {
  var lines = data.trim().split('\n');
  var keys = lines[0].split(',');
  lines.splice(0, 1);

  return lines.map(function (line) {
    var obj = {};
    line.split(',').map(function (value, i) {
      obj[keys[i].trim()] = value.trim();
    });
    return obj;
  });
}

module.exports = {
  translate: _csv2json
};