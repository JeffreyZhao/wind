"use strict";

var Jscex = require("../../src/jscex");
require("../../src/jscex-async").init();
require("../../src/jscex-async-powerpack").init();

require("chai").should();
require("./tests").setupTests(Jscex);
