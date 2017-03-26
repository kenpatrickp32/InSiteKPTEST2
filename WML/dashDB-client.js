//This module will be the one responsible for extracting SPSS_INPUT_TABLE 
//(tableName1) and DIG_HISTORY (tableName2) from dashDB for Watson
//Machine Learning model and function for inserting SPSS_OUTPUT_TABLE (tableName3)
//back to dashDB

'use strict';

var config = require('../config');
var ibmdb = require('ibm_db');

//This will be the function definition for inserting the corresponding data to 
//the SPSS_INPUT (tableName3) from both ILI input and its Dig History (if applicable)
function _insertData(conn) {
  return function (tableName1, tableName2, tableName3, header, data, nameTranslationTable, callback) {
    /*var convertedData = data.map(function (dataLine) {
      var convertedDataLine = Object.keys(dataLine).map(function (key) {
        var value = dataLine[key];
        return value;
      });

      return convertedDataLine.join(', ');
    });

    var translatedHeader = header;

    if (nameTranslationTable)
      translatedHeader = header.map(function (headerEl) {
        return nameTranslationTable[headerEl];
      });
    var query = `insert into ${tableName3} (${translatedHeader.join(', ')}) values (${convertedData.join('), (')})`;
      */
    var query = `INSERT INTO ${tableName3} (SELECT ${tableName1}.*, 
    ${tableName2}.REPAIR_TYPE_DETAILS, ${tableName2}.DIG_COMPLETION_YEAR
    FROM ${tableName1} FULL OUTER JOIN ${tableName2} ON 
    ${tableName1}.DISTANCE__M_= ${tableName2}.ILI_CHAINAGE 
    ORDER BY ${tableName1}.DISTANCE__M_)`;
    
    console.log("Executing SQL query: _insertData()");
    conn.query(query, function (err, queryData) {
      if (err) {
        console.log(err);
        return callback(err);
      }
      return callback();
    });
  };
}

//This will be the function definition for exporting the results after 
//running the analysis in Watson Machi9ne Learning
function _exportData(conn){
	
}

function _connect(dbCredentials, callback) {
  console.log("Now going to the _connect(dbCredentials, callback) function");
  var hostname = dbCredentials.hostname;
  var username = dbCredentials.username;
  var password = dbCredentials.password;
  var port = dbCredentials.port;

  var url = `DRIVER={DB2};DATABASE=BLUDB;HOSTNAME=${hostname};UID=${username};PWD=${password};PORT=${port};PROTOCOL=TCPIP`;
  console.log("now on url: %o", url);

  ibmdb.open(
    url,
    function (err, conn) {
      if (err) {
        console.log(err);
        return callback(err);
      }

      console.log("dashDB now open for business");
        return callback(null, {
          initTable: function (tableName1, tableName2, tableName3, callback) {
            var query = `SELECT * from ${tableName3}`;
            console.log("Executing SQL query: 'selecting all'");
            conn.query(query, function (err, data) {
              if (err || data.length === 0) {
                var query = `CREATE TABLE ${tableName3} AS 
                (SELECT ${tableName1}.*, ${tableName2}.REPAIR_TYPE_DETAILS, 
                ${tableName2}.DIG_COMPLETION_YEAR FROM ${tableName1}
                FULL OUTER JOIN ${tableName2} ON 
               ${tableName1}.DISTANCE__M_=${tableName2}.ILI_CHAINAGE) WITH NO DATA`;
                console.log("Executing SQL query: initializing a brand new table");
                conn.query(query, function (err, data) {
                  callback(err, data);
                });
              } else {
              	var query = `delete from ${tableName3}`;
                console.log("Executing SQL query: initializing a brand new table");
                conn.query(query, function (err, data) {
                  callback(err, data);
                });
              }
            });
          },
          deleteTable: function (tableName3, callback) {
            var query = `drop table ${tableName3}`;
            console.log("Executing SQL query: initializing a brand new table");
            conn.query(query, function (err, data) {
              callback(err, data);
            });
          },
          
          insertData: _insertData(conn),
          
          exportData: _exportData(conn),
          
          close: function (callback = function () {}) {
            conn.close(function (err) {
              console.log("connection with dashDB closed");
              callback(err);
            });
          }
        });
    }
  );
}

module.exports ={connect: _connect};