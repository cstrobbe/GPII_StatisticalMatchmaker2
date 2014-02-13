var fluid = fluid || require("infusion"),
    when = when || require("when");

var gpii = fluid.registerNamespace("gpii"),
	stat = fluid.registerNamespace("gpii.matchMaker.statistical");

stat.match = function (callbackWrapper, preferences, solutions, originalModel, strategy) {
	// Statistical MM integration:
	preferences = gpii.matchMaker.statistical.infer(preferences);
	// Original matchMaker.match function:
	return when(gpii.matchMaker.disposeSolutions(preferences, solutions, strategy), function (disposed) {
		var togo = [];
		fluid.each(disposed, function(solrec) {
			if (solrec.disposition === "accept") {
				togo.push(solrec.solution);
			}
		});
		return togo;
	});
};

stat.infer = function (preferences) {
	try {
		var cluster = stat.getClosestCluster(preferences.applications);
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
		fluid.log(err);
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

