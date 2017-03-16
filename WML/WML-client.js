//Credentials for Watson Machine Learning service copied from VCAP

'use strict';

const request=require('request');
const fs=require('fs');
const WMLhelper=require('./WML-helper');
const log4js = require;

var WatsonService=module.exports=function(WMLServiceCredentials){
	let credentials = WMLServiceCredentials;
	//check to see if credentials are undefined and response to that
	if(typeof credentials == 'undefined' && credentials == null){
		let config = require('../config');
		let WMLServiceName = process.env.WML_SERVICE_LABEL ? process.env.PA_SERVICE_LABEL : 'pm-20';
		let val = config(WMLServiceName);
		if (typeof val !== 'undefined' && val!== null){
			credentials = val.credentials;
		}
	}
	if (credentials){
		if (credentials.url !== null) {
			let {url} = credentials;
			let v1Url = '/pm/v1';
			this.baseUrl = url.includes(v1Url) ? url : url+v1Url;
			if (!this.baseUrl.endsWith('/')){
				this.baseUrl += '/';
			}
		}
		else {
			console.log('url is not defined in WML service definition - base url is now an empty string');
			this.baseurl = '';
		}
		this.accessKey = credentials.access_key;
	}
};

//defining the prototype for the Watson Service i.e. service url, error response, etc
WatsonService.prototype ={
	_constructURL: function (url, params){
		let queryString = '?';
		for (let key in params){
			queryString += key + '=' + params[key] + '&';
		}
		return this.baseUrl + url + queryString + 'accesskey=' + this.accessKey;
	},
	//Error response handler prototype
	_handleResponse: function (logContext, callback){
		return function (error, response, body){
      if (typeof response === 'string') {
        try {
          response = JSON.parse(response);
        } catch (err) {
          if (!error && !body)
            return callback(null, response);
        }
      }
      if (!error && ((response.statusCode >= 200 && response.statusCode <300) || response.flag)) {
      	return callback(null, body);
      }
      if (error){
      	return callback(error);
      }
      else if (response.statusCode < 200 || response.statusCode >= 300){
      	return callback(response.statusCode);
      }
      else if (!response.flag && response.message){
      	return callback(response.message);
      }
      var errorMsg = 'Undefined error occured, logContextL ${JSON.stringify(logContext)}, error: ${error}, responseL ${JSON.stringify(response)}, body: ${body}';
      return callback(errorMsg);
			};
		},
		
		getAccessKey: function(){
			return this.accessKey;
		},
		
		get: function (url, params, callback){
			if (typeof params === 'function'){
				callback = params;
				params = {};
			}
			if (typeof callback !== 'function'){
				throw new Error('Callback must be a function');
			}
			
			let requestURL = this._constructUrl(url, params);
			
			request.get({url: requestURL}, this._handleResponse(url, callback));
		},
		
		put: function(params, callback){
			var paramsCopy = JSON.parse(JSON.stringify(params));
			if (paramsCopy.url){
				paramsCopy.url = paramsCopy.url.replace(this.getAccessKey(),'xxx');
			}
			
			if (typeof params === 'function'){
				callback = params;
				params ={};
			}
			if (typeof callback !== 'function'){
				throw new Error('Callback must be a function');
			}
			request.put(params, this._handleResponse(params,callback));
		},
		
		//getting the .str SPSS model from WML
		getModel: function (contextId, callback){
			this.get('metadata/' + contextId, function (error, body) {
				if (error) {
					return callback(error);
					}
				var metadata = JSON.parse(body);
				var flag = metadata.flag;
				var message = metadata.message;
				if (flag) {
					WMLhelper.parseModelMetaData(message, function (error, model) {
						if (error){
							return callback(error);
							}
						model.id = contextId;
						return callback(null, model);
						});
						} 
						else {
							error = new Error('Watson Machine Learning service error: ' + message);
							return callback(error);
							}
							});
				},
				
		//defining the scoring batch api call 
		getScore: function(contextId, scoreParam, callback){
			let scoreUri = this._constructUrl('/score/' + contextId);
			var body = JSON.stringify(scoreParam);
			
			//make the post api call
			request.post({
				headers: {'content-type':'application/json'},
				url: scoreUri,
				body: body
			}, 
			function (error, response, body){
				if (!error && response.statusCode===200){
					var scoreResponse = JSON.parse(body);
					if (scoreResponse.flag === false){
						console.log("error in getScore() during scoring stream")
						return callback('Watson Machine Learning service error: ' + scoreResponse.message);
					}
					return callback(null, scoreResponse);
					}
					else if (error){
						return callback(error);
					}
						error = new Error('Service error code: ' + response.statusCode);
						return callback(error);
			});
		},
		
		uploadModel: function (fileId, filePath, callback){
			let url = this._constructURL('model/', fileId);
			let params ={
				headers: {'content-type':'multipart/form-data'},
				url: url,
				formData:{
					'model_file': fs.createReadStream(filePath)
				}
			};
			this.put(params, this._handleResponse(url, callback));
		},
		
		downloadModel: function (modelId, filePath, callback){
			var writeStream = fs.createWriteStream(filePath);
			let url = this._constructURL('model/', modelId);
			
			writeStream.on('open',function(){
				request(url, function(err){
					if (err){
						return callback(err);
					}
				}).pipe(writeStream).on('finish',function(){
					return callback();
			});
		});
		},
		
		deleteModel: function (fileId, callback){
			let url = this._constructURL('model/'+fileId);
			request.delete(url,this._handleResponse(url, callback));
		},
		
		uploadFile: function (fileId, filePath, callback){
			let url = this._constructURL('file/'+fileId);
			
			let params = {
				headers: {'content-type':'multipart/form-data'},
				url: url,
				formData:{'model_file':fs.createReadStream(filePath)}
			};
			this.put(params,this._handleResponse(url, callback));
		},
		
		//delete the batch job when not needed and call _handleResponse to nuke everything about it when called
		deleteJob: function(fileId, callback){
			let url = this._constructURL('jobs/', fileId);
			request.delete(url,this._handleResponse(url, callback));
		},
		
		//this is the prototype for defining the job description i.e. API call for creating a batch job
		createJob: function(action, jobId, modelId, modelName, tableName, inputsNode, callback){
			let url = this._constructURL('./jobs'+jobId);
			let params ={
				headers:{'content-type':'application/json'},
				url: url,
				body: WMLhelper.getJobJson(action, modelId, modelName, tableName, inputsNode)
			};
			this.put(params, function(error, response,body){
				if (error){
					return callback(error);
				}
				return callback(null, JSON.parse(response));
			});
		},
		
		getJobStatus: function(jobId,callback){
			let url = 'jobs/'+jobId+'/status';
			this.get(url, function(error, response, body){
				if (error){
					return callback(error);
				}
				return callback(null, JSON.parse(response));
			});
		}
};
