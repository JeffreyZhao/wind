"use strict";

var Jscex = require("../../src/jscex");
require("../../src/jscex-async").init(Jscex);
require("../../src/jscex-async-powerpack").init(Jscex);

require("chai").should();
require("./tests").setupTests(Jscex);