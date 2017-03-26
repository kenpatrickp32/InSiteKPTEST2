/* This will be the definition for the API calls for the batch jobs for InSite */

'use strict';

var WMLClient = require('./WML-client');
var request = require('request');
var pa2json=require('./pa2json-util');
var fs = require('fs');
var uuid = require('node-uuid');
var config = require('../config');
var fs = require('fs');
var dashDBClient = require('./dashDB-client');


let wmlClient = new WMLClient();

function _constructDataDownloadUrl(url){
	return `${url}?accesskey=${wmlClient.getAccessKey()}`;
}

function _waitForBatchJobToFinish(jobId, callback){
	console.log('_waitForBatchJobToFinish %s',`${jobId}`);
	var intervalId = setInterval(function(){
		wmlClient.getJobStatus(jobId, function(error, status){
			switch (status.jobStatus){
				case 'SUCCESS': 
					clearInterval(intervalId);
					console.log('_waitforBatchJobToFinish()');
					return callback(null, status);
				case 'RUNNING':
					console.log('Batch Job RUNNING!');				
					break;
				case 'PENDING':
					console.log('_waitForBatchJobToFinish() "PENDING"');
					break;
				case 'FAILED':
					clearInterval(intervalId);
					console.log('Batch Job FAILED!');
					return callback(status.failureMsg);
				default:
					clearInterval(intervalId);
					return callback(status);
			}
		});
	}, 2000);
}

function _doJob(action, jobId, fileId, fileName, tableName1, inputsTable1, tableName2, inputsTable2, tableName3, outputsTable, insertMode, callback){
	wmlClient.createJob(action, jobId, fileId, fileName, tableName1, inputsTable1, tableName2, inputsTable2, tableName3, outputsTable, insertMode,function(error, data){
		if (error !== null){
			console.log(error);
			return callback(error);}
			
		_waitForBatchJobToFinish(jobId, function(error, status){
			if (error !== null){
				console.log(error);
				return callback(error);}
			console.log('_doJob() successful');
			return callback(null, status);	
		});
	});
}

//need to consider both SPSS_INPUT and DIG_HISTORY
//prepping export Table as well
function _prepareDatabase(tableName1, tableName2, data, callback){
	console.log('preparing database');
	dashDBClient.connect(config('dashDB').credentials, function (error, dbConnector){
		if (error)
			return callback(error.message);
		dbConnector.initTable(tableName1, function (error){
			if (error)
				return callback(error.message);
			var header = Object.keys(data.data[0]);
			var nameTranslationTable = {};
			header.forEach(function (headerEl){
				nameTranslationTable[headerEl]=headerEl.toUpperCase().replace(' ', '_');
			});
			dbConnector.insertData(tableName1, tableName2, header, data.data, nameTranslationTable, function(error){
				if (error){
					console.log("Failed to call 'insertData'");
					return callback(error.message);}
				dbConnector.close();
				return callback();
			});
		});
	});
}

function _reloadTrainedModel(url, fileId, filePath, callback){
	request(
		{
			method: 'GET',
			url: _constructDataDownloadUrl(url),
			encoding: null
		},
		function(error, response, body){
			if (error !== null)
				return callback(error);
			fs.writeFile(`${filePath}`, body, function(error){
				wmlClient.uploadFile(fileId, filePath, function(error, jobUploadData){
					if (error !== null)
						return callback(error);
					return callback();
				});
			});
		}
	);
}

//preparing the environment
function _prepareEnv(modelId, fileId, filePath, tableName1, tableName2, data, callback){
	var basicPath = filePath.split('/');
	basicPath.splice(basicPath.length-1,1);
	//if "basicPath" doesn't exist, make a new one
	if (!fs.existsSync(basicPath))
		fs.mkdirSync(basicPath);
		
	wmlClient.downloadModel(modelId, filePath, function(error){
		if (error)
			return callback(error);
		wmlClient.uploadFile(fileId, filePath, function(error, jobUpload){
			if (error)
				return callback(error);
			_prepareDatabase(tableName1, tableName2, data, function(error){
				if (error)
					return callback(error);
				return callback();
			});
		});
	});
}

//cleaning all the previous jobs, intervalIds i.e. spring cleaning
function _clean(basicModelFileId, trainedModelFileId,trainingJobId, scoringJobId, trainedModelDownloadId, scoringDataDownloadId, tableName1){
	var maxCounter = 10;
	var counter = 7;
	
	wmlClient.deleteFile(basicModelFileId, function (error){
		counter--;
	});
	wmlClient.deleteFile(trainedModelFileId, function(error){
		counter--;
	});
	wmlClient.deleteFile(trainedModelDownloadId, function(error){
		counter--;
	});
	wmlClient.deleteFile(scoringDataDownloadId, function(error){
		counter--;
	});
	wmlClient.deleteJob(trainingJobId, function(error){
		counter--;
	});
	wmlClient.deleteJob(scoringJobId,function(error){
		counter--;
	});
	dashDBClient.connect(config('dashDB').credentials, function(error, dbConnector){
		if (error)
			return error;
		dbConnector.deleteTable(tableName3, function(err){
			dbConnector.close();
			counter--;
		});
	});
	var intervalId = setInterval(function(){
		--maxCounter;
		if (maxCounter === 0)
			clearInterval(intervalId);
		if (counter === 0)
			clearInterval(intervalId);
	}, 1000);
}

function _run(data, modelId,callback){
	//assign a unique id for each batch jobs
	var uniqueId = uuid.v4();
	var basicModelFileId = 'basicModelFileId_'+uniqueId;
	var basicModelFilePath = 'app_server/models/downloaded.str';
	
	var trainedModelFileId = 'trainedModelFileId_'+uniqueId;
	var trainedModelFilePath = 'app_server/models/trained.str';
	
	var trainingJobId = 'training_job_id_'+uniqueId;
	var scoringJobId = 'scoring_job_id'+uniqueId;
	
	//This might be different since we want these table names to reflect the inputted ILI data
	var tableName1 = 'ILI_INPUT_'+uniqueId.toUpperCase().split('-').join('_');
	var tableName2 = 'DIG_HISTORY_'+uniqueId.toUpperCase().split('-').join('_');
	var tableName3 = 'SPSS_INPUT_'+uniqueId.toUpperCase().split('-').join('_');
	var tableName4 = 'SPSS_OUTPUT_'+uniqueId.toUpperCase().split('-').join('_');
	
	var trainedModelDownloadId = '';
	var scoringDataDownloadId = '';
	
	_prepareEnv(modelId, basicModelFileId, basicModelFilePath, tableName1,tableName2, tableName3 data, function (error, jobUploadData){
		if (error)
			return callback([error]);
		_doJob('TRAINING',trainingJobId, basicModelFileId,'tsfinalout.str',tableName1)		
	});
}

//export _run to be used for routing/live scoring
module.exports= {run: _run};