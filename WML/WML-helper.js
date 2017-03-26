//This will be the helper module for the WML batch calls 
//like parsing the model metadata for the scoring branch of the model and getting the training json training definition

'use strict';

const config = require('../config');
const parseString = require('xml2js').parseString;


let db2Host = config('dashDB:credentials:host');
let db2Password = config('dashDB:credentials:password');
let db2Port = config('dashDB:credentials:port');
let db2Username = config('dashDB:credentials:username');


function getJobJson(action, modelId, modelName, tableName1, inputsNode1, tableName2, inputsNode2, tableName3, outputsNode, insertMode) {
  let training = require('./training.json');
  return eval('`' + JSON.stringify(training) + '`');
}


function parseModelMetadata(metadata, callback) {
  parseString(metadata, {
    trim: true
  }, function (error, result) {
    if (!error) {
      var scoringInput = {
        'tableData': {}
      };

      result['metadata']['table'].forEach(function (tableEntry) {
        var fields = tableEntry['field'];
        var fieldsNames = {};
        for (var item in fields) {
          fieldsNames[fields[item]['$']['name']] = fields[item]['$']['storageType'];
        }
        scoringInput.tableData[tableEntry['$']['name']] = fieldsNames;
        });
        return callback(null, scoringInput);
        }
      return callback(error);
  });
}

module.exports = {
	getJobJson:getJobJson,
	parseModelMetaData:parseModelMetadata
};