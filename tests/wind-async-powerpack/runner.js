"use strict";

var Wind = require("../../src/wind");
require("../../src/wind-async").init();
require("../../src/wind-async-powerpack").init();

require("chai").should();
require("./tests").setupTests(Wind);
