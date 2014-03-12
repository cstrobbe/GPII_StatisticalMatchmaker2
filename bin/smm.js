#!/usr/bin/env node

var fluid = require("universal"),
    kettle = fluid.registerNamespace("kettle");

fluid.require("../lib/StatisticalMatchMaker.js", require);

kettle.config.makeConfigLoader({
    nodeEnv: kettle.config.getNodeEnv(),
    configPath: kettle.config.getConfigPath() ||
        require("path").resolve(__dirname, "../configs")
});
