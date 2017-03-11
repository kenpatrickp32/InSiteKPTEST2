//This will be the configuration index for the app that will take in VCAP service
//credentials from JSON

'use strict';

const nconf = require('nconf');
const path =require('path');

nconf.argv();

nconf.add('vcapServices',{type:'literal',store: _getVcapServicesAsJson()});

nconf.file('dev',path.join(__dirname, 'vcapserv.json'));


function _flattenArrayDataInJson(jsonObj){
	for (let p in jsonObj){
		if (Array.isArray(jsonObj[p])){
			jsonObj[p]=jsonObj[p][0];
		}
	}
	return jsonObj;
}

//getting the VCAP Services Credentials from vcapserv.json 
function _getVcapServicesAsJson(){
	let vcapSvcRaw = process.env.VCAP_SERVICES;
	let vcapSvcJSON;
	//Parse VCAP Services into JSON
	if (vcapSvcRaw){
		console.log('Parsin JSON from VCAP_SERVICES environment variable');
		try{
			vcapSvcJSON = JSON.parse(vcapSvcRaw);
			if(!vcapSvcJSON){
				console.log('VCAP_SERVICES JSON is not defined');
				return null;
			}
			vcapSvcJSON = _flattenArrayDataInJson(vcapSvcJSON);
		}
		catch (error){
			console.log('Failed to parse JSON from VCAP_Services environment variable');
			console.log(error);
			return null;
		}
	}

		return vcapSvcJSON;
}

module.exports=nconf.get.bind(nconf);