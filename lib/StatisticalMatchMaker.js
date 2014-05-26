var fluid = fluid || require("universal");

var matchMaker = fluid.registerNamespace("gpii.matchMaker");
var stat = fluid.registerNamespace("gpii.matchMaker.statistical");
var Client = require('node-rest-client').Client;

fluid.require("./StatisticalMatchMakerData.js", require);

var path = require("path");
var when = require("when");
var fs = require('fs');
var $ = fluid.registerNamespace("jQuery");
var gpii = fluid.registerNamespace("gpii");
var http = require('http');
var url = require('url');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

fluid.defaults("gpii.matchMaker.statistical.matchPost", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    invokers: {
        match: {
            funcName: "gpii.matchMaker.statistical.matchPostMatch",
            args: ["{gpii.matchMaker}", "{that}.when", "{arguments}.0", "{arguments}.1", "{request}.req.body"]
        }
    }
});

gpii.matchMaker.statistical.matchPostMatch = function (matchMaker, when, solutions, preferences, originalModel) {
	// Statistical MM integration:
	preferences = gpii.matchMaker.statistical.infer(preferences);
	// Original matchMaker.match function:
	return when(gpii.matchMaker.disposeSolutions(preferences, solutions, gpii.matchMaker.flat.disposeStrategy), function (disposed) {
		var togo = [];
		fluid.each(disposed, function(solrec) {
			if (solrec.disposition === "accept") {
				togo.push(solrec.solution);
			}
		});
		// Fix ApplicationSettings payloads
		togo.forEach(function(sol) {
			if (sol.id in preferences.applications) {
				sol.settingsHandlers[0].applicationSettings = preferences.applications[sol.id]["parameters"];
				//delete sol.settingsHandlers[0].capabilities;
				//delete sol.settingsHandlers[0].capabilitiesTransformations;
			}
		});
		return togo;
	})
};

fluid.defaults("kettle.requests.request.handler.matchPostStatistical", {
    gradeNames: ["autoInit", "fluid.gradeLinkageRecord"],
    contextGrades: ["kettle.requests.request.handler.matchPost"],
    resultGrades: ["gpii.matchMaker.statistical.matchPost"]
});

stat.infer = function (preferences) {
	try {
		var cluster;
		if ("applications" in preferences) {
			cluster = stat.getClosestCluster(preferences.applications);
		} else {
			cluster = stat.clusters[0];
			preferences.applications = {};
		}
		fluid.each(cluster, function(settings, application){
			if (!(application in preferences.applications)) {
				preferences.applications[application] = {};
				preferences.applications[application]["id"] = application;
				if (!(stat.windowsRegistryMess.indexOf(application) >= 0)) {
					preferences.applications[application]["parameters"] = settings;
				} else {
					// Fix for windows setting that was supposed to be implemented LONG AGO
					preferences.applications[application]["parameters"] = {};
					fluid.each(settings, function(settingValue, settingKey){
						preferences.applications[application]["parameters"][settingKey] = {};
						preferences.applications[application]["parameters"][settingKey]["value"] = settingValue;
						preferences.applications[application]["parameters"][settingKey]["dataType"] = "REG_DWORD";
					});
				}
			}
		});
	} catch(err) {
		fluid.log("====== SMM ERROR ======");
		fluid.log(err);
		fluid.log("====== SMM ERROR ======");
	}
    return preferences;
};

stat.getClosestCluster = function (preferences) {
	var distance = Infinity;
	var cluster;
	fluid.each(stat.clusters, function(curCluster){
		var curDistance = stat.getClusterDistance(preferences, curCluster);
		if (curDistance < distance) {
			cluster = curCluster;
			distance = curDistance;
		};
	});
	return cluster;
};

stat.getClusterDistance = function (preferences, cluster) {
	var result = 0;
	fluid.each(preferences, function(preference){
		var prefKey = preference.id;
		var prefValues = preference.parameters;
		fluid.each(prefValues, function(prefValue, prefValueKey){
			if (!(prefKey in cluster)) {
				result = result + 0.5;
			} else if (!(prefValueKey in cluster[prefKey])) {
				result = result + 0.5;
			} else if (prefValue != cluster[prefKey][prefValueKey]) {
				var clusterValue = cluster[prefKey][prefValueKey];
				var statType = stat.preferenceTypes[prefKey][prefValueKey];
				if (typeof prefValue == "object" && prefValue != null) {
					prefValue = prefValue["value"];
				}
				if (statType["isEnum"]) {
					result = Math.max(Math.min( result + 1 / statType["max"] ,1),0);
				} else if (statType["min"] != statType["max"]) {
					result = Math.max(Math.min( result + Math.abs( (prefValue - statType["min"]) / (statType["max"] - statType["min"]) - (clusterValue - statType["min"]) / (statType["max"] - statType["min"]) ) ,1),0);
				}
			};
		});
	});
	return result;
};

stat.windowsRegistryMess = [
	"com.microsoft.windows.magnifier"
];
