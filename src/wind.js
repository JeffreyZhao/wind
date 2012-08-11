/***********************************************************************
  The only purpose of this file is to load all the Wind.js modules and
  return the root object in Node.js environment.
 ***********************************************************************/
 
var Wind = require("./wind-core");
require("./wind-compiler").init();
require("./wind-async").init();
require("./wind-promise").init();

module.exports = Wind;